const config = require("./config")
const fs = require("fs")
const db = require("./db").db
const Discord = require("discord.js")
exports.functions =  functions = {
    ticket: function(message) {
        const args = message.content.split(" ").slice(1);
        var user = message.mentions.users.first();
        if (!user) user = message.guild.members.get(args[args.length - 1])
        const reason = args.slice(1, args.length - 1).join(" ");
        const geniuses = message.guild.roles.get(config.geniuses)
        const moderators = message.guild.roles.get(config.moderators)
        const title = args[0];
        const desc = reason;
        if (!user || !title || !desc) return message.reply("Syntax for ``ticket`` is ``!ticket <name> <description> <user>``").then(e => e.delete(config.message_deletion_time)).catch(console.error)
        var id = 0
        try {
            id = parseInt(db.getData("/number")) + 1
            db.push("/number", id)
        }
        catch(error) {
            id = 0;
            db.push("/number",0)
        };
        message.guild.createChannel(title, 'text', [{
                        id: user.id,
                        allow: ['READ_MESSAGES', 'SEND_MESSAGES']
                    },
                    {
                        id: geniuses.id,
                        allow: ['READ_MESSAGES', 'MANAGE_MESSAGES', 'SEND_MESSAGES']
                    },
                    {
                        id: moderators.id,
                        allow: ['READ_MESSAGES', 'SEND_MESSAGES']
                    },
                    {
                        id: message.guild.id,
                        deny: ['READ_MESSAGES']
                    }
                ])
                .then(ch => ch.setParent(config.parent))
                .then(ch => ch.setTopic(desc))
                .then(ch => ch.send(`${user}, ${desc}` + "\n\n\nThis ticket will be archived after 24 hours of inactivity.\nTicket ID: #" + id))
                .then(ch => ch.pin(desc))
                .then(ch => {
                    message.reply(`${ch.channel} has been created!`).then(e => e.delete(config.message_deletion_time))
                    db.push("/tickets[]", {
                        channel_id: ch.channel.id,
                        users_id: [user.id],
                        name: title,
                        creation_date: Date.now(),
                        id : id
                    })
                })
    },
    add: function(message) {
        let user = message.mentions.users.first();
        if (!user) user = message.guild.members.get(message.content.split(" ").slice(1)[0])
        if (!user) return message.reply("I couldn't find this user.").then(e => e.delete(config.message_creation_date))
        message.channel.overwritePermissions(user, {
            'READ_MESSAGES': true
        }).catch(console.error);
        const tickets = db.getData('/tickets')
        var ticket = tickets.filter(ticket => ticket.channel_id === message.channel.id)[0]
        if (!ticket) return message.reply("You can only add new users to ticket channels.").then(e => e.delete(config.message_deletion_time))
        if (ticket.users_id.indexOf(user.id) > -1) return message.reply("This user is already added!").then(e => e.delete(config.message_deletion_time))
        db.delete(`/tickets[${tickets.indexOf(ticket)}]`)
        ticket.users_id.push(user.id)
        db.push("/tickets[]/", ticket)
        return message.channel.send(user + ", You been added to the channel!").then(e => e.delete(config.message_deletion_time))

    },
    rename: async function(message) {
        const name = message.content.split(" ").slice(1)[0]
        const tickets = db.getData('/tickets')
        var ticket = tickets.filter(ticket => ticket.channel_id === message.channel.id)[0]
        if (!ticket) return message.reply("You can only use ``rename`` in ticket channels.").then(e => e.delete(config.message_deletion_time))
        db.delete(`/tickets[${tickets.indexOf(ticket)}]`)
        ticket['name'] = name
        db.push('/tickets[]', ticket)
        await message.channel.edit({
            name: name
        })
        return message.reply("Successfully renamed the ticket to ``" + name + '`` !').then(e => e.delete(config.message_deletion_time))
    },
    view: async function(message){
        const ID = parseInt(message.content.split(" ").slice(1)[0])
        if (isNaN(ID)) return message.reply("Please provide a valid ID.").then(e=>e.delete(config.message_deletion_time))
        const ticket = db.getData("/tickets").filter(ticket=>ticket.id === ID)[0]
        if (!ticket) return message.reply("I couldn't find this ticket.").then(e=>e.delete(config.message_deletion_time))
        const embed = new Discord.RichEmbed()
        .setTitle("Ticket Overview")
        .setColor(0x00FF7F)
        .addField("Name",ticket.name)
        .addField("ID",'#' + ticket.id)
        .setFooter(`Requested by ${message.author.tag} | ${message.author.id}`)
        .addField(`User ${ticket.users_id.length > 1 ? 's' : ''}`,ticket.users_id.map(user=>`<@!${user}>`) )
        .addField('Closed',ticket.closed ? 'True' : 'False')
        .addField("Opened At",Date(ticket.creation_date).toString())
        if (ticket.closed == true) {
            embed.addField('Closed At',Date(ticket.closure_date).toString())
            embed.addField('Reason for closure',ticket.reason)
        }
        return message.channel.send({embed}).catch(console.error);

    },
    close: async function(message) {
        const args = message.content.split(" ").slice(1);
        const reason = args[0];
        const db_tickets = db.getData("/tickets")
        var ticket = db_tickets.filter(ticket => ticket.channel_id === message.channel.id)[0]
        if (!ticket) return message.reply("Only ticket channels are deletable.").then(e => e.delete(config.message_deletion_time))
        else if (ticket.closed) return message.reply("This ticket has already been closed.").then(e => e.delete(config.message_deletion_time))
        const users = ticket.users_id.map(id => message.guild.members.get(id))
        if (!reason) return message.reply("Syntax for ``close`` is `!close <reason>(solved or control)`").then(e => e.delete(config.message_deletion_time))
        db.delete(`/tickets[${db_tickets.indexOf(ticket)}]`);
        let data = db.getData(`/ticket/channels/${message.channel.id}/messages/`)
        var post_string = ''
        for (const id in data) {
            const msg = data[id]
            if (msg.tag && msg.content) post_string += `\n${msg.tag}: ${msg.content}`
        }
        const code = Math.random().toString(36).substring(7);
        fs.writeFile(config.tickets_dir + code + '.txt', post_string, function(err) {
            if(err) return console.log(err);
        });
        const archive_channel = message.guild.channels.get(config.archive_channel)
        if (archive_channel) archive_channel.send(`Archive from "${message.channel.name}" ticket\n` + config.website + code)
        if (reason.toLowerCase() == "solved") {
            if (users) {
                for (var e = 0; e < users.length; e++) {
                    if (users[e]) await users[e].send("Hello, your ticket has solved! Here is a link to the archive to the ticket.\n" + config.website + code)
                }
            }
        } else if (reason.toLowerCase() == "control" && users) {
            for (var e = 0; e < users.length; e++) {
                await users[e].send("Hello, your ticket has been closed due to the fact it is out of the Geniuses' control. Here is a link to the archive of the ticket.\n" + config.website + code)
            }
        }
        ticket['pastebin'] = config.website + code
        ticket['closed'] = true
        ticket['reason'] = reason
        ticket['closure_date'] = Date.now()
        db.push("/tickets[]", ticket)
        return message.channel.delete().catch(console.error);
    }
}
