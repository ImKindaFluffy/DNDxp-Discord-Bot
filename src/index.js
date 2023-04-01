require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Client, IntentsBitField } = require('discord.js');
const {Player,playerSchema} = require('./models/model');

const app = express();
const URI = process.env.MONGO_URI;

app.use(express.json());

app.listen(3000, () => {
    console.log(`Server Started at ${3000}`);
});

mongoose.connect(URI);
const database = mongoose.connection;

database.on('error', (error) => {
    console.log(error);
})

database.once('connected', () => {
    console.log('Connected to MongoDB');
})

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

client.on('ready', (g) => {
    console.log(`${g.user.tag} is online!`);
});

client.on('guildCreate', guild => {
    var server_id = mongoose.model(guild.id, playerSchema)
    server_id.createCollection();

    var message =`Thank you for inviting me!\nUse the !Help command to see what I can do!`

    guild.systemChannel.send(message);
});

client.login(process.env.DISCORD_TOKEN);

client.on('messageCreate', async (message) => {
    
    var addXpCommand = /!AddXp/i;
    var loseXpCommand = /!LoseXp/i;
    var addPlayerCommand = /!AddPlayer/i;
    var deletePlayerCommand = /!DeletePlayer/i;
    var experienceCheckCommand = /!XPCheck/i;
    var allPlayersCommand = /!AllPlayers/i;
    var helpCommand = /!Help/i;

    if(message.author.bot){
        return;
    }

    var isAdmin = message.member.roles.cache.some(role => role.name === 'Admin')

    if(message.content.match(addXpCommand) && isAdmin){
        AddXp(message);
    }
    else if(message.content.match(loseXpCommand) && isAdmin){
        LoseXp(message);
    }
    else if(message.content.match(addPlayerCommand) && isAdmin){
        AddPlayer(message);
    }
    else if(message.content.match(deletePlayerCommand) && isAdmin){
        DeletePlayer(message);
    }
    else if(message.content.match(allPlayersCommand) && isAdmin){
        AllPlayers(message);
    }
    else if(message.content.match(helpCommand) && isAdmin){
        Help(message);
    }
    else if(message.content.match(experienceCheckCommand)){
        ExperienceCheck(message);
    }
    else if(message){
        var p_id =`<@${message.author.id}>`;
        var server_id = message.guildId;

        var conditions = {player_id: String(p_id), server: String(message.guildId)};
        const player = await database.collection(server_id).findOne(conditions);

        if(player == null){
            
            return;
        };

        var newExp = Number(player.experience) + 5;
        if(newExp >= 9999999){
            newExp = 9999999;
        };

        if(player.level != 20){
            LevelUp(newExp, player.level, server_id, p_id, message)
        };

        await database.collection(server_id).updateOne(
            conditions, {$set: {experience: newExp}}
        );  
    };
});

async function Help(message){
    var help = `
    Commands - 
        !AddPlayer - Adds a new player to your party!
            EXAMPLE: !AddPlayer @DiscordName CharacterName

        !DeletePlayer - Removes an existing player from your party! 
            EXAMPLE: !DeletePlayer @DiscordName

        !AllPlayers - Returns a list of the players within your party! 
            EXAMPLE: !AllPlayers

        !Receive - Gives a player of your choice experience points! 
            EXAMPLE: !AddXp @DiscordName 200

        !Remove - removes experience points from a player of your choice! 
            EXAMPLE: !LoseXp @DiscordName 200

        !ExpCheck - Returns back the ammount of experience points from a player of your choice! 
            EXAMPLE: !XPCheck @DiscordName

        !Help - Returns the message you are currently reading with the list of commands and how to use them
        
    Capilization doesnt matter in the command names themselves.
    You must tag the player (Example: @DNDxp) as this bot uses that unique id to associate the player with the character`;

    message.reply(help);
};

async function AllPlayers(message){
    var server_id = String(message.guildId);
    
    const player = await database.collection(server_id).find();
    var all = new Array;

    player.forEach(p => {
        all.push(` ${p.player_id}: ${p.name}`);
    }).then(() => {
        message.reply(String(all));
    });
};

async function AddXp(message){
    var player_id = /<@.*>/i;
    var exp = /\s\d.*/;
    var xp = message.content.match(exp);
    var p_id = message.content.match(player_id);
    var server_id = message.guildId;

    var conditions = {player_id: String(p_id), server: String(message.guildId)};

    const player = await database.collection(server_id).findOne(conditions);

    if(player == null){
        message.reply(`${p_id} is not currently in your party!`);
        return;
    };

    var newExp = Number(xp) + Number(player.experience);

    if(player.experience <= 9999999){
        if(newExp > 9999999){
            newExp = 9999999;
        }
        await database.collection(server_id).updateOne(
            conditions, {$set: {experience: newExp}}
        );
    };

    if(player.level != 20){
        LevelUp(newExp, player.level, server_id, p_id, message)
    };

    message.reply(`${p_id}'s character ${player.name} has received ${Number(xp)} experience and now has ${newExp} total experience!`);
}

async function LoseXp(message){
    var player_id = /<@.*>/i;
    var exp = /\s\d.*/;
    var xp = message.content.match(exp);
    var p_id = message.content.match(player_id);
    var server_id = message.guildId;

    var conditions = {player_id: String(p_id), server: String(message.guildId)};

    const player = await database.collection(server_id).findOne(conditions);

    if(player == null){
        message.reply(`${p_id} is not currently in your party!`);
        return;
    };

    var newExp = Number(player.experience) - Number(xp);

    if(newExp <= 0){
        await database.collection(server_id).updateOne(
            conditions, {$set: {experience: 0}}
        );

        newExp = 0;
    }
    else if(newExp > 0){
        await database.collection(server_id).updateOne(
            conditions, {$set: {experience: newExp}}
        );
    };

    if(player.level != 1){
        LevelUp(newExp, player.level, server_id, p_id, message);
    };
    message.reply(`${p_id}'s character ${player.name} has lost ${Number(xp)} experience and has ${newExp} experience remaining!`);
}

async function AddPlayer(message){
    var cName = /\s\w.*/i;
    var player_id = /<@.*>/i;
    var msg = message.content.match(cName);
    var p_id = message.content.match(player_id);
    var server_id = message.guildId;
    var conditions = {player_id: String(p_id[0]), server: String(message.guildId)};
    const player = await database.collection(server_id).findOne(conditions);

    if(player != null){
        message.reply(`${p_id} is already in your party`);
        return;
    }

    const newPlayer = new Player({player_id: p_id[0], name: msg[0].trim(), server: String(server_id), experience: 0, level: 1});
    await database.collection(server_id).insertOne(newPlayer);

    message.reply(`${p_id}'s character ${msg[0].trim()} has been added to your party!`);
}

async function DeletePlayer(message){
    var player_id = /<@.*>/i;
    var p_id = message.content.match(player_id);
    var server_id = message.guildId;

    var conditions = {player_id: String(p_id[0]), server: String(message.guildId)};
    const player = await database.collection(server_id).findOne(conditions);

    if(player == null){
        message.reply(`${p_id[0]} is not in your party!`);
        return;
    }else{
        await database.collection(server_id).findOneAndDelete(
            conditions
        );
    
        message.reply(`${p_id}'s character ${player.name} has been removed from your party!`);
    }
}

async function ExperienceCheck(message) {
    var player_id = /<@.*>/i;
    var p_id = message.content.match(player_id)
    var server_id = message.guildId;

    var conditions = {player_id: String(p_id), server: String(message.guildId)};
    const player = await database.collection(String(server_id)).findOne(conditions);

    if(player == null){
        message.reply(`${p_id} is not currently in your party!`);
        return;
    }

    message.reply(`${p_id}'s character ${player.name} is level ${player.level} and has ${player.experience} Experience!`);
}

async function LevelUp(exp, level, server_id, player_id, message){

    var two = 300;
    var three = 900;
    var four = 2700;
    var five = 6500;
    var six = 1400;
    var seven = 23000;
    var eight = 34000;
    var nine = 48000;
    var ten = 64000;
    var eleven = 85000;
    var twelve = 100000;
    var thirteen = 120000;
    var fourteen = 140000;
    var fifteen = 165000;
    var sixteen = 195000;
    var seventeen = 225000;
    var eighteen = 265000;
    var nineteen = 305000;
    var twenty = 355000;

    var conditions = {player_id: String(player_id), server: server_id};

    if(exp < two && level != 1){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 1}}
        );
    
        message.reply("You are now Level 1");
    }

    else if(exp >= two && exp < three && level != 2){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 2}}
        );
    
        message.reply("You are now Level 2");
    }
    else if(exp >= three && exp < four && level != 3){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 3}}
        );

        message.reply("You are now Level 3!")
    }
    else if(exp >= four && exp < five && level != 4){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 4}}
        );

        message.reply("You are now Level 5!")
    }
    else if(exp >= five && exp < six && level != 5){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 5}}
        );

        message.reply("You are now Level 5!")
    }
    else if(exp >= six && exp < seven && level != 6){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 6}}
        );

        message.reply("You are now Level 6!")
    }
    else if(exp >= seven && exp < eight && level != 7){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 7}}
        );

        message.reply("You are now Level 7!")
    }
    else if(exp >= eight && exp < nine && level != 8){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 8}}
        );

        message.reply("You are now Level 8!")
    }
    else if(exp >= nine && exp < ten && level != 9){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 9}}
        );

        message.reply("You are now Level 9!")
    }
    else if(exp >= ten && exp < eleven && level != 10){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 10}}
        );

        message.reply("You are now Level 10!")
    }
    else if(exp >= eleven && exp < twelve && level != 11){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 11}}
        );

        message.reply("You are now Level 11!")
    }
    else if(exp >= twelve && exp < thirteen && level != 12){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 12}}
        );

        message.reply("You are now Level 12!")
    }
    else if(exp >= thirteen && exp < fourteen && level != 13){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 13}}
        );

        message.reply("You are now Level 13!")
    }
    else if(exp >= fourteen && exp < fifteen && level != 14){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 14}}
        );

        message.reply("You are now Level 14!")
    }
    else if(exp >= fifteen && exp < sixteen && level != 15){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 15}}
        );

        message.reply("You are now Level 15!")
    }
    else if(exp >= sixteen && exp < seventeen && level != 16){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 16}}
        );

        message.reply("You are now Level 16!")
    }
    else if(exp >= seventeen && exp < eighteen && level != 17){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 17}}
        );

        message.reply("You are now Level 17!")
    }
    else if(exp >= eighteen && exp < nineteen && level != 18){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 18}}
        );

        message.reply("You are now Level 18!")
    }
    else if(exp >= nineteen && exp < twenty && level != 19){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 19}}
        );

        message.reply("You are now Level 19!")
    }
    else if(exp >= twenty && level != 20){
        await database.collection(server_id).updateOne(
            conditions, {$set: {level: 20}}
        );

        message.reply("Congratulations! You are now Level 20!")
    };
}