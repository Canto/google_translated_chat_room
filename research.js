// require module
var io = require('socket.io')(3000);
var mysql = require('mysql');
var async = require('async');
var apikey = 'API KEY';
var trans = require('google-translate')(apikey);
// set mysql connection
var conn = mysql.createConnection({
	host : process.env.DB_HOST || 'localhost',
	user : process.env.DB_USER || 'research',
	password : process.env.DB_PASS || 'research',
	database : process.env.DB_NAME || 'research'
});

// convert array to object
function toObject(arr) {
  var rv = {};
  for (var i = 0; i < arr.length; ++i)
    rv[i] = arr[i];
  return rv;
}

// connect socket
io.on('connection',function(socket){
	
	//Delete unused room.
	setInterval(function(){
		conn.query("SELECT * FROM `research` ",function(err,rows){
			async.each(rows,function(arr,callback){
				if(!io.sockets.connected[arr.id]){
					console.log(socket.id+"/"+arr.id);
					conn.query("DELETE FROM research WHERE id = ?",[arr.id],function(err,rows){
						var leave = { num : arr.group , name : arr.name};
						console.log(leave);
						io.in(arr.group).emit('leave',leave);
					});
				}
			});
		});
	}, 5000);

	// join the translated chat room.
	socket.on('joingroup',function(join){
		
		// insert database room member data.
		var insertSQL = { id : socket.id , group : join.num , lang : join.lang , name : join.name , deviceid : join.deviceid};
		conn.query('INSERT INTO research SET ?', insertSQL , function(err,rows){
			//console.log(err);
		});
		socket.join(join.num);
		io.in(join.num).emit('join',join);
	});

	//get translated chat room data.
	socket.on('groupinfo',function(group){
		console.log(group.num);
		conn.query('SELECT * FROM `research` WHERE `group` = ?',[group.num],function(err,rows){
			var obj = toObject(rows);
			console.log(obj);
			io.in(group.num).emit('groupmemberlist',obj);
			//console.log(rows);
		});
	});

	//leaving translated chat room.
	socket.on('leavinggroup',function(leave){
		socket.leave(leave.num);
		io.in(leave.num).emit('leave',leave);
		conn.query("DELETE FROM research WHERE id = ?",[socket.id],function(err,rows){});
	});

	// sending message.
	socket.on('send',function(data){
		console.log(data.num);
		var transTextKO,transTextJa,TransTextEn,TransTextFr,TransTextCh;
		conn.query("SELECT DISTINCT `lang` FROM `research` WHERE `group` = ?",[data.num],function(err,rows){
			async.each(rows,function(arr,callback){
				if(arr.lang != data.lang){
					trans.translate(data.message,arr.lang,function(err,translate){
						
							conn.query("SELECT * FROM `research` WHERE `group` = ? AND `lang` = ?",[data.num , arr.lang],function(err,rows){
								async.each(rows,function(jaArr,jacallback)
								{
								if(io.sockets.connected[jaArr.id]){
									data.message = translate.translatedText;
									io.sockets.connected[jaArr.id].emit('message',data);	
								}
								});
							});
						

					});
				}
				else
				{
					conn.query("SELECT * FROM `research` WHERE `group` = ? AND `lang` = ?",[data.num , data.lang],function(err,rows){
								console.log(rows);
								async.each(rows,function(jaArr,jacallback)
								{
								if(io.sockets.connected[jaArr.id] && jaArr.id != socket.id){
									io.sockets.connected[jaArr.id].emit('message',data);
								}
								});
					});
				}
				
			});
			
		});
		//io.in(data.num).emit('message',data);
		
	});
});
