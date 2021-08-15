const {
    Client
} = require('@notionhq/client');

const client = new Client({
    auth: process.env.NOTION_ACCESS_TOKEN
});

const Enmap = require("enmap")
states = new Enmap({
    name: "States"
})
repeatingTasks = new Enmap({
    name: "repeatingTasks"
})

const loopTimer = 10000;

let cursor = undefined;
setInterval(async () => {
    let databaseID = "4183c7afc303488d8218667be35b2621";

    if (!cursor) {
        const database = await client.databases.query({
            database_id: databaseID
        })

        database.results.forEach((page, i) => {
            // Timeout to prevent sending too many requests at once
            setTimeout(() => {
                titleState(page)
                weekDay(page)
                repeatingTask(page)
                //autoStatus(page)
            }, 1000 * i);
        })

        if (database.has_more) {
            cursor = database.next_cursor
        }
    } else {
        const database = await client.databases.query({
            database_id: databaseID,
            start_cursor: cursor
        })

        database.results.forEach((page, i) => {
            // Timeout to prevent sending too many requests at once
            setTimeout(() => {
                titleState(page)
                weekDay(page)
                repeatingTask(page)
                //autoStatus(page)
            }, 1000 * i);
        })

        if (database.has_more) {
            cursor = database.next_cursor
        } else {
            cursor = undefined
        }
    }


    // Updating state of repeating tasks
    let now = new Date()
    let array = Array.from(repeatingTasks, ([name, value]) => ({ name, value }));

    let dailyID = "d2e5c824-c854-4aed-98a2-315902767adb"
    let weeklyID = "8e3352db-8948-4a0b-8c45-907698bbf4a8"
    let monthlyID = "50216fa5-d12e-461b-a67d-a7175c178681"
    let inProgID = "e72b06b8-ad9b-4d73-bb66-e0978ad09a12"

    asyncForEach(array, async task => {
        let page = await client.pages.retrieve({
            page_id: task.name
        })

        if (page.properties.State.select.id !== inProgID) {
            if (now.getHours() == 1) {
                if (page.properties.Repeating.select.id == dailyID) {
                    console.log("test")
                    changeState(client, page, inProgID)
                } else if (now.getDay() == 1 && page.properties.Repeating.select.id == weeklyID) {
                    changeState(client, page, inProgID)
                } else if (now.getDate() == 1 && page.properties.Repeating.select.id == monthlyID) {
                    changeState(client, page, inProgID)
                }
            }
        }
    })

}, loopTimer);

/**
 * Checks what tasks are repeating and saves them in enmap
 * @param {object} page 
 */
function repeatingTask(page, i) {
    if (page.properties.Repeating) {
        repeatingTasks.set(page.id, page.properties.Repeating.select.id)
    }
}

/**
 * Updates the weekly view by changing the day property if the task is within this week. 
 * @param {object} page 
 */
async function weekDay(page) {
    let dayIDs = [
        undefined, // Sunday
        "4d51dd0a-2d31-46b2-b824-4fc21e1f20f2", // Monday
        "f7207ad7-da1c-4856-b34a-a524892373a7", // Tuesday
        "fc45b55d-5000-43a2-8583-b0aae52ec7de", // Wednesday
        "5d0b9910-7533-4b40-80e5-e71461fd6a47", // Thursday
        "e2605933-dc6a-4045-82e9-be8f4f263d91", // Friday
        undefined // Saturday
    ]

    if (page.properties.Date) {
        let startTime = new Date(page.properties.Date.date.start)
        let dayNumberStart = startTime.getDay()

        if (page.properties.Date.date.end) {
            let endTime = new Date(page.properties.Date.date.end)
            let days = []

            let dates = getDates(startTime, endTime)

            dates.forEach(date => {
                if (isDateInThisWeek(date) && dayIDs[date.getDay()]) {
                    days.push({
                        id: dayIDs[date.getDay()]
                    })
                }
            })
            if (page.properties.Day.multi_select == days) return

            setDays(client, page, days)

        } else {

            if (isDateInThisWeek(startTime)) {
                let days = []
                if (dayIDs[dayNumberStart]) {
                    days.push({
                        id: dayIDs[dayNumberStart]
                    })
                    if (page.properties.Day.multi_select == days) return

                    setDays(client, page, days)
                }
            } else {
                setDays(client, page, [])
            }

        }
    } else if (page.properties.Day.multi_select[0]) {
        setDays(client, page, [])
    }
}

/**
 * Updates the title of each page to show state and % completed
 * @param {object} page 
 */
async function titleState(page) {
    let ignoreTaskTypes = ["Vacation", "PartialVacation", "SubTask", "ReportTask", "Meeting"]
    if (page.properties.TaskType) {
        if (!~ignoreTaskTypes.indexOf(page.properties.TaskType.select.name)) {

            //console.log("Update: " + page.properties.Name.title[0].plain_text)
            let title
            let total;
            let finished;
            let finishedPercent;

            if (page.properties.TotalSubtasks.rollup.number == 0) {
                if (page.properties.TotalSubtasks2.rollup.number == 0) {
                    finishedPercent = `[] `;
                } else {
                    total = page.properties.TotalSubtasks2.rollup.number;
                    finished = page.properties.CompleteSubtasks2.rollup.number
                    finishedPercent = `[${Math.round(finished / total * 100)}%] `;
                }
            } else {
                total = page.properties.TotalSubtasks.rollup.number;
                finished = page.properties.CompleteSubtasks.rollup.number
                finishedPercent = `[${Math.round(finished / total * 100)}%] `;
            }
            if (!page.properties.Name.title[0]) {
                title = ""
            } else title = page.properties.Name.title[0].plain_text;

            if (!page.properties.State) {
                if (title.includes('[] ' + finishedPercent)) return
                setTitle(client, page, `[] ${finishedPercent}${title.replace(/\[.*\]\s*/gm, '')}`)
                return
            }

            let state = page.properties.State.select.name;

            if (states.has(state)) {
                if (title.includes(states.get(state).displayText + finishedPercent)) return
                setTitle(client, page, states.get(state).displayText + finishedPercent + title.replace(/\[.*\]\s*/gm, ''))
            } else {
                states.set(state, {
                    displayText: `[${state}] `,
                    id: page.properties.State.select.id
                })
                if (title.includes(states.get(state).displayText + finishedPercent)) return
                setTitle(client, page, states.get(state).displayText + finishedPercent + title.replace(/\[.*\]\s*/gm, ''))
            }
        } else {
            if (page.properties.Name.title[0]) {
                if (page.properties.Name.title[0].plain_text.match(/^\[.*\] \[.*\] /gm)) {
                    setTitle(client, page, page.properties.Name.title[0].plain_text.replace(/^\[.*\] \[.*\] /gm, ''))
                }
            }
        }
    }
}

async function autoStatus(page) {

    if (page.properties.AutoState.checkbox) {
        let reports = page.properties.Prepreq1_input.relation

        let done = true
        await asyncForEach(reports, async report => {
            let reportPage = await client.pages.retrieve({
                page_id: report.id
            })

            if (reportPage.properties.State.select.name !== "Done") {
                done = false
            }
        })
        if (done) {
            setSelect(client, page, '2745c29d-7acc-4def-8433-7e646c0bf61c')
        } else {
            setSelect(client, page,)
        }
    }
}

/**
 * Sets the title of the given page to the given title
 * @param {Object} client   notion client
 * @param {object} page     the page to update the title for
 * @param {string} title    new title for page
 */
async function setTitle(client, page, title) {
    let lastEdit = page.properties["Last edited by"].last_edited_by
    if (lastEdit.type == "person") {
        try {
            await client.pages.update({
                page_id: page.id,
                properties: {
                    Name: {
                        id: "title",
                        title: [{
                            text: {
                                content: title
                            }
                        }]
                    },
                    PersonChange: {
                        people: [{
                            id: lastEdit.id
                        }]
                    }
                }
            })
        } catch (e) {
            console.log(`Got err: ${e} \nwhen changing Title of: ${page.properties.Name.title[0].plain_text}`)
        }
    } else {
        try {
            await client.pages.update({
                page_id: page.id,
                properties: {
                    Name: {
                        id: "title",
                        title: [{
                            text: {
                                content: title
                            }
                        }]
                    }
                }
            })
        } catch (e) {
            console.log(`Got err: ${e} \nwhen changing Title of: ${page.properties.Name.title[0].plain_text}`)
        }
    }
}

/**
 * Changes the Day multiselect to the given day(s)
 * @param {Object} client 
 * @param {object} page 
 * @param {Array} days 
 */
async function setDays(client, page, days) {
    let lastEdit = page.properties["Last edited by"].last_edited_by
    if (lastEdit.type == "person") {
        try {
            await client.pages.update({
                page_id: page.id,
                properties: {
                    Day: {
                        multi_select: days
                    },
                    PersonChange: {
                        people: [{
                            id: lastEdit.id
                        }]
                    }
                }
            })
        } catch (e) {
            console.log(`Got err: ${e} \nwhen changing Day of: ${page.properties.Name.title[0].plain_text}`)
        }
    } else {
        try {
            await client.pages.update({
                page_id: page.id,
                properties: {
                    Day: {
                        multi_select: days
                    }
                }
            })
        } catch (e) {
            console.log(`Got err: ${e} \nwhen changing Day of: ${page.properties.Name.title[0].plain_text}`)
        }
    }
}

/**
 * Changes the state of a task
 * @param {object} client 
 * @param {object} page 
 * @param {string} stateID 
 */
async function changeState(client, page, stateID) {
    let lastEdit = page.properties["Last edited by"].last_edited_by
    if (lastEdit.type == "person") {
        try {
            await client.pages.update({
                page_id: page.id,
                properties: {
                    State: {
                        select: {
                            id: stateID
                        }
                    },
                    PersonChange: {
                        people: [{
                            id: lastEdit.id
                        }]
                    }
                }
            })
        } catch (e) {
            console.log(`Got err: ${e} \nwhen changing State of: ${page.properties.Name.title[0].plain_text}`)
        }
    } else {
        try {
            await client.pages.update({
                page_id: page.id,
                properties: {
                    State: {
                        select: {
                            id: stateID
                        }
                    }
                }
            })
        } catch (e) {
            console.log(`Got err: ${e} \nwhen changing State of: ${page.properties.Name.title[0].plain_text}`)
        }
    }
}

/**
 * Checks if given date is in this week
 * @param {Date} date 
 * @returns {boolean}
 */
function isDateInThisWeek(date) {
    const todayObj = new Date();
    const todayDate = todayObj.getDate();
    const todayDay = todayObj.getDay();

    // get first date of week
    const firstDayOfWeek = new Date(todayObj.setDate(todayDate - todayDay));

    // get last date of week
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);

    // if date is equal or within the first and last dates of the week
    return date >= firstDayOfWeek && date <= lastDayOfWeek;
}

/**
 * Creates an array of dateobjects with all the dates between two dates
 * @param {Date} startDate 
 * @param {Date} stopDate 
 * @returns {Array}
 */
function getDates(startDate, stopDate) {
    var dateArray = [];
    var currentDate = startDate;
    while (currentDate.getTime() <= stopDate.getTime()) {
        dateArray.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dateArray;
}

/**
 * Foreach loop that supports async functions
 * @param {*} array 
 * @param {*} callback 
 */
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}