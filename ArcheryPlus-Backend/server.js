/**
 * Created by tcassembler on 16/7/25.
 */

// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

const MAX_ROOM = 1000;
var user = 0;
var rooms = [];
var allClients = {};
//socket
io.on('connection', function(socket) {

    /**
     *
     */
    socket.on('init', function(data) {
        console.log('init invoked with data: ' + data);
        var json = JSON.parse(data);
        allClients[socket] = json['username'];

        //console.log('current user: ' + io.clients.length);
        console.log(++user + ' users connect to server.');
    });
    /**
     *
     */
    socket.on('join_room', function(data) {
        console.log('join_room invoked with data:' + data);
        var json = JSON.parse(data);
        var roomId = json['room_id'], username = json['username'], rating = json['rating'],
            perfect300Level = json['perfect300_level'], logoUrl = json['logo_url'];
        console.log(' join room ' + roomId + " with username " + username);
        //console.log('Client with index : ' + i);
        var currentUser = {username : username, rating : rating, perfect300_level : perfect300Level, logo_url : logoUrl};
        //socket.join(roomId);
        // the room is not full.
        var index = findRoomByRoomId(roomId);
        if (index > -1 && index < rooms.length) {
            rooms[index]['joiner'] = currentUser;
            rooms[index]['count'] = 2;
            socket.join(roomId);

            io.in(roomId).emit('join_room_callback', JSON.stringify({joiner : currentUser}));

            console.log("Callback information: " + JSON.stringify({joiner : currentUser}));
        }  else {
            console.log('Error: room ' + roomId + ' cant found.');
        }
    });

    /**
     *
     */
    socket.on('can_join_room', function(data) {
        console.log('can_join_room invoked with data:' + data);
        var json = JSON.parse(data);
        var roomId = json['room_id'];
        socket.emit('can_join_room_callback', JSON.stringify({access : rooms[findRoomByRoomId(roomId)]['count'] == 1 ? 1 : 0}));
    });

    /**
     *
     */
    socket.on('leave_room', function(data) {
        console.log('left_room with data: ' + data);
        var json = JSON.parse(data);
        leaveRoom(this, json['room_id'], json['username']);
    });

    /**
     *
     */
    socket.on('disconnect', function(data) {

        var index = findRoomByUsername(allClients[socket]);
        if (index > -1 && index < rooms.length) {
            leaveRoom(this, rooms[index]['room_id'], allClients[socket]);
        } else {
            console.log('user ' + allClients[socket] + ' is in arena.');
        }
        allClients.splice(index, 1);
        user--;
        console.log('One user disconnect! ' + allClients[socket] + " left! ");
    });

    /**
     *
     */
    socket.on('ready_to_start', function(data) {
        console.log('ready_to_start with data: ' + data);
        var json = JSON.parse(data);
        var roomId = json['room_id'];
        io.in(roomId).emit('ready_to_start_callback', "{}");
        console.log('ready_to_start_callback with no data');
    });

    /**
     *
     */
    socket.on('start_game', function(data) {
        console.log('start_game with data: ' + data);
        var json = JSON.parse(data);
        var roomId = json['room_id'];
        io.in(roomId).emit('start_game_callback', "{}");
        console.log('start_game with no data');
    });

    /**
     *
     */
    socket.on('submit_score', function(data) {
        console.log("submit_score with data: " + data );
        var json = JSON.parse(data);
        var roomId = json['room_id'], username = json['username'], scores = json['scores'], round = json['round'];
        var room = rooms[findRoomByRoomId(roomId)];
        //First round
        if (round == 1 && room['scores'] == undefined) {
            room['scores'] = [];
        }

        //console.log('The owner username: ' + room['owner']['username'] + ' and the submit username: ' + username);
        if (room['owner']['username'] === username) {
            // if owner submit score
            var lastRoundScore = round > 1 ? room['scores'][round - 2]['owner'][room['scores'][round - 2]['owner'].length - 1] : 0;
            scores.push(scores[scores.length - 1] + lastRoundScore);
            if (room['scores'].length < round) {
                var obj = {'owner' : scores};
                room['scores'].push(obj);
                console.log('add new scores ' + room['scores'][round - 1]['owner']);
            } else {
                room['scores'][round - 1]['owner'] = scores;
            }
        } else {
            // if joiner submit score
            var lastRoundScore = round > 1 ? room['scores'][round - 2]['joiner'][room['scores'][round - 2]['joiner'].length - 1] : 0;
            scores.push(scores[scores.length - 1] + lastRoundScore);
            if (room['scores'].length < round) {
                var obj = {'joiner' : scores};
                room['scores'].push(obj);
            } else {
                room['scores'][round - 1]['joiner'] = scores;
            }
        }

        //console.log('current scores: ' + JSON.stringify(room['scores']));
        if (room['scores'][round - 1]['owner'] != undefined && room['scores'][round - 1]['joiner'] != undefined) {
            console.log("emit get_score with data: " + JSON.stringify(room['scores'][round - 1]));
            io.in(roomId).emit('get_score', JSON.stringify(room['scores'][round - 1]));
        }
    });

    /**
     *
     */
    socket.on('get_room', function(data) {
        console.log("emit get_room event.");
        //console.log('Get room list : ' + result);
        var roomsDTO = [];
        rooms.forEach(function(room) {
            var roomDTO = {};
            roomDTO['room_id'] =room['room_id'];
            roomDTO['owner'] = room['owner'];
            roomDTO['arrow_per_round'] = room['arrow_per_round'];
            roomDTO['countdown_per_round'] = room['countdown_per_round'];
            roomDTO['total_round'] = room['total_round'];
            roomDTO['count'] = room['count'];
            roomsDTO.push(roomDTO);
        });
        var result = {'rooms' : roomsDTO};
        socket.emit('get_room_callback', JSON.stringify(result));
        console.log("callback with data: " + JSON.stringify(result));
    })

    /**
     *
     */
    socket.on('create_room', function(data) {
        console.log('create room with data:' + data);

        var json = JSON.parse(data);
        var username = json['username'], rating = json['rating'], perfect300Level = json['perfect300_level'], logoUrl = json['logo_url'],
            arrowPerRound = json['arrow_per_round'], countdownPerRound = json['countdown_per_round'], totalRound = json['total_round'];
        var currentUser = {username : username, rating : rating, perfect300_level : perfect300Level, logo_url : logoUrl};
        var roomId = randomIntInc(1, MAX_ROOM);

        var room = {};
        room['room_id'] = roomId;
        room['arrow_per_round'] = arrowPerRound;
        room['countdown_per_round'] = countdownPerRound;
        room['total_round'] = totalRound;
        room['owner'] = currentUser;
        room['count'] = 1;
        rooms.push(room);
        console.log('create room with id: ' + roomId);
        socket.join(roomId);
        console.log('save user info: ' + currentUser);
        //console.log('save room info: ' + JSON.stringify(rooms[roomId]));

        var callback = {room_id : roomId};
        io.in(roomId).emit('create_room_callback', JSON.stringify(callback));
    })

    /**
     *
     */
    socket.on('finish_game', function(data) {
        console.log('finish game with data: ' + data);

        var json = JSON.parse(data);
        var roomId = json['room_id'];

        //var owner = rooms[roomId]['owner']['username'], joiner = rooms[roomId]['joiner']['username'];

        //TODO save scores to db. And delete scores in memory.

        socket.leave(roomId);
        var index = findRoomByRoomId(roomId);
        if (index > -1 && index < rooms.length) {
            rooms.splice(index, 1);
        } else {
            console('Error: room ' + roomId + ' cant found.');
            return;
        }
        console.log('finish game end. delete room ' + roomId);
    });

    /**
     *
     * @param low
     * @param high
     * @returns {number}
     */
    function randomIntInc (low, high) {
        return Math.floor(Math.random() * (high - low + 1) + low);
    }
    /**
     *
     * @param socket
     * @param roomId
     * @param username
     */
    function leaveRoom(socket, roomId, username) {
        console.log('left room ' + roomId + " with username " + username);

        var index = findRoomByRoomId(roomId);
        if (index > -1 && index < rooms.length) {
            if (rooms[index]['owner']['username'] === username) {
                rooms.splice(index, 1);
            } else {
                rooms[index]['joiner'] = undefined;
                rooms[index]['count'] = 1;
            }
        } else {
            console('Error: room ' + roomId + ' cant found.');
            return;
        }
        socket.leave(roomId);
        io.in(roomId).emit('leave_room_callback', "{}");
        console.log('leave room successfully.');
    }

    /**
     *
     * @param roomId
     * @returns {number}
     */
    function findRoomByRoomId(roomId) {
        var index = -1;
        rooms.forEach(function (room) {
            index++;
            if (room['room_id'] === roomId) {
                return;
            }
        });
        return index;
    }

    /**
     *
     * @param username
     * @returns {number}
     */
    function findRoomByUsername(username) {
        var index = -1;
        rooms.forEach(function (room) {
            index++;
            if (room['owner'] && room['owner']['username'] === username) {
                return;
            } else if (room['joiner'] && room['joiner']['username'] === username) {
                return;
            }
        });
        return index;
    }

});
