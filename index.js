var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var DBconn = mysql.createConnection({
	host: '127.0.0.1',
	user: 'vucms',
	password: 'Vucms0202',
	database: 'rozy'
});
var client_id = []
var live_id = []
/**
 * {socket_id:xxxxxxx,user_id,position: 1|2,last_update:datetime}
 */
DBconn.connect();

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
	socket.on('MsgSend', (m) => {
		check = false
		for(let client of client_id){
			if(client.socket_id==socket.id && client.position==m.position){
				check=true
				break
			}
		}
		if(check){
			setTimeout(() => {
				if(m.position==1){
					DBconn.query(`INSERT INTO messages (msg,idsell,idcus,position) VALUE('${m.msg}',(SELECT id FROM sellers where user_id=${m.to}),(SELECT id FROM customers where user_id=${m.from}),1)`)
				}else{
					DBconn.query(`INSERT INTO messages (msg,idsell,idcus,position) VALUE('${m.msg}',(SELECT id FROM sellers where user_id=${m.from}),(SELECT id FROM customers where user_id=${m.to}),2)`)
				}
			}, 500);
			for(let client of client_id){
				if(m.position==1){
					if(client.user_id==m.to && client.position==2){
						io.to(client.socket_id).emit('client-msg',{from:m.from,msg:m.msg,position:1})
						break;
					}
				}else{
					if(client.user_id==m.to && client.position==1){
						io.to(client.socket_id).emit('seller-msg',{from:m.from,msg:m.msg,position:2})
						break;
					}
				}
			}
		}else console.log('false')
	})
	socket.on('config_socket_id', config => {
		DBconn.query('SELECT count(*) FROM users where password=\''+config.hash+'\' AND id=' + parseInt(config.user_id), function (error, results, fields) {
			if (error) throw error;
			console.log(results[0]['count(*)'])
			if (results[0]['count(*)'] > 0) {
				check = false
				for (let key in client_id) {
					if (client_id[key].user_id == config.user_id && client_id[key].position == config.position) {
						client_id[key].socket_id = socket.id
							client_id[key].last_update = new Date()
						check = true
						break;
					}
				}
				if (check === false) {
					client_id.push({
						socket_id: socket.id,
						user_id: config.user_id,
						position: config.position,
						last_update: new Date()
					})
				}
				console.log(client_id)
			}
		});

	})
	socket.on('join_stream',config=>{
		live_id.push({
			socket_id:socket.id,
			key:config.key
		})
	})
	socket.on('getStream',data=>{
		key = data.key
		for(let live of live_id){
			if(live.key==key){
				io.to(socket.id).emit('receivedStream',{stream:live.stream})
				break
			}
		}
	})
	socket.on('disconnect',()=>{
		for(let live of live_id){
			if(live.socket_id==socket.id && live.key){
				DBconn.query(`UPDATE streams SET status=0 WHERE stream_key='${live.key}'`, function (error, results, fields) {
					if (error) throw error;
				});
				break;
			}
		}
	})
	socket.on('clearStream',obj=>{
		for(let live of live_id){
			if(live.key==obj.key){
				io.to(live.socket_id).emit('closeStream',{})
				break
			}
		}
	})
});
http.listen(3333, function () {
	console.log('listening on *:3333');
});