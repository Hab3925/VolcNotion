module.exports.run = async (enmaps) => {
    const Discord = require('discord.js');
    const client = new Discord.Client({
        ws: {
            intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MEMBERS', 'GUILD_MESSAGE_REACTIONS']
        }
    });

    client.on("message", message => {
        let prefix = ""
        let args = message.content
            .slice(prefix.length)
            .trim()
            .split(" ");
        let command = args.shift().toLowerCase();

        if (command == "enmap") {
            console.log(command)

            const {
                inspect
            } = require("util");
            if (enmaps[args[0]] instanceof Map) {
                if (args[1] == "delete") {
                    try {
                        enmaps[args[0]].clear()
                        message.channel.send(`Deleted content of ${args[0]}`)
                    } catch (e) {
                        message.channel.send(`Cannot delete content because: \`${e}\``)
                    }
                } else if (args[1] == "set") {
                    if (!args[3]) return message.channel.send("You need to add the content you want to set")
                    try {
                        enmaps[args[0]].set(args[2], JSON.parse(args[3]))
                        message.channel.send(`Set ${args[2]} = ${args[3]} in ${args[0]}`)
                    } catch {
                        enmaps[args[0]].set(args[2], args[3])
                        message.channel.send(`Set ${args[2]} = ${args[3]} in ${args[0]}`)
                    }
                } else if (args[1] == "get") {
                    if (!args[2]) return message.channel.send("You have to say what variable you want to `get`")
                    message.channel.send(`\`\`\`` + inspect(enmaps[args[0]].get(args[2])) + `\`\`\``)
                } else {
                    message.channel.send("Invalid operation")
                }
            } else {
                message.channel.send(`Thats not an enmap.`)
            }
        }


    })


    client.login(loginToken);
}