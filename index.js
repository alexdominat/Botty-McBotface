const Discord = require('discord.js');
const client = new Discord.Client();
const config = require("./config.json");
const cron = require('node-cron');
const fs = require("fs")
const functions = require("./functions").functions
const db = require("./db").db

function timeCheck() {
    var db_tickets;
    var tickets = []
    try{
    db_tickets = db.getData("/tickets")
    tickets = db_tickets.map(ticket => ticket.channel_id)
    }
    catch(err){}
    if (!tickets.length) return undefined
    tickets = tickets.filter(ticket => !ticket.closed)
    for (var i = 0; i <= tickets.length; i++) {
        const channel = client.channels.get(tickets[i]);
        if (channel){
        channel.fetchMessages({
                limit: 10
            }).then(async messages => {
                const lastMessage = messages.filter(message => !message.author.bot && !message.deleted).first();
                if (!lastMessage) return undefined
                    if (Date.now() - lastMessage.createdTimestamp >= 86400000) {
                        var ticket = db_tickets.filter(ticket => ticket.channel_id === tickets[i])
                        db.delete(`/tickets[${db_tickets.indexOf(ticket)}]`)
                        var post_string = ''
                        let data = db.getData(`/ticket/channels/${lastMessage.channel.id}/messages/`)
                        for (const id in data) {
                            const msg = data[id]
                            if (msg.tag && msg.content) post_string += `\n${msg.tag}: ${msg.content}`
                        }       
                        const code = Math.random().toString(36).substring(7);
                        fs.writeFile(config.tickets_dir + code + '.txt', post_string, function(err) {
                            if(err) return console.log(err);
                        });               
                        ticket['reason'] = 'inactivity'
                        ticket['closed'] = true
                        ticket['pastebin'] = config.website + code
                        db.push('/tickets[]', ticket)
                        await lastMessage.channel.delete()
                    }
            })
            .catch(console.error);
        }
    }
}


client.on("ready", () => {
    console.log("Ready with " + client.guilds.size + " guilds and " + client.users.size + " users!");
    cron.schedule('* * * * *', () => timeCheck());
})
client.on("messageUpdate", (old_message, new_message) => {
    if (!new_message.channel.parent || old_message.author.bot) return undefined
    if (new_message.channel.parent.id !== config.parent) return undefined
    var tickets = []
    try{
        tickets = db.getData('/tickets/')
    }
    catch(err){}
    const isTicket = tickets.map(ticket=>ticket.channel_id).indexOf(message.channel.id) !== -1
    if (!isTicket) return undefined
    db.push(`/ticket/channels/${new_message.channel.id}/messages/${new_message.id}/content/`, new_message.content)
})

client.on("messageDelete", message => {
    if (!message.channel.parent || message.author.bot) return undefined
    if (message.channel.parent.id !== config.parent) return undefined
    var tickets = []
    try{ tickets = db.getData('/tickets/').map(obj=>obj.channel_id) }
    catch(err){}
    const isTicket = tickets.indexOf(message.channel.id) !== -1
    if (!isTicket) return undefined
    db.push(`/ticket/channels/${message.channel.id}/messages/${message.id}/isDeleted/`, 'true')
})


client.on('message', async message => {
    if (message.author.bot || message.webhookID || message.system) return undefined
    var tickets = []
    try{ tickets = db.getData('/tickets/').map(obj=>obj.channel_id) }
    catch(err){}
    const should_save_message = tickets.indexOf(message.channel.id) !== -1
    if (message.member.roles.exists("id", config.geniuses) || message.member.roles.exists("id", config.moderators)) {
        if (!message.content.startsWith(config.prefix)){
            if(should_save_message) saveMessage(message)
            return undefined
        }
        const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();
        if (!functions[command] && should_save_message) return saveMessage(message)
        else if (!functions[command] && !should_save_message) return undefined
        else {
            message.delete().catch(console.error);
            functions[command](message)
        }
    }
    else if (should_save_message) saveMessage(message)

});

client.login(config.token);



function saveMessage(message){
    const string = `/ticket/channels/${message.channel.id}/messages/${message.id}`
    db.push(string + '/author/', message.author.id)
    db.push(string + '/tag/', message.author.tag)
    db.push(string + '/content/', message.content)
}
