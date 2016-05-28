var express = require('express');
var request = require('request');
var path = require('path');
var app = express();
var router = express.Router();
var Firebase = require('firebase');
var qs = require('querystring');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var amqp = require('amqplib/callback_api');

var keys = require ('./keys.json');

app.use(express.static(path.join(__dirname, 'public')));

// Setting ejs view engine
app.use(express.static(__dirname + 'public/stylesheets'));
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(expressSession({
	secret: 'keyboard cat',
	resave: true,
	saveUninitialized: true,
	cookie: { secure: false }
}));

var app_id = keys.fb_app_id;
var app_secret = keys.fb_app_secret;

var access_token;
var birthday, music, movies, books, games;

var firebase_secret = keys.firebase_secret;
var ref = new Firebase("https://apprc.firebaseio.com");


app.get('/', function(req,res,next){
        res.sendFile(path.join(__dirname, '/public', 'index.html'));
        });

app.get('/homepage', function(req,res,next){
        res.sendFile(path.join(__dirname, '/public', 'homepage.html'));
        });
           
app.get('/chisiamo', function(req,res,next){
        res.sendFile(path.join(__dirname, '/public', 'chisiamo.html'));
        });
           
app.get('/contattaci', function(req,res,next){
        res.sendFile(path.join(__dirname, '/public', 'contattaci.html'));
        });
           
app.get('/apis', function(req,res,next){
        res.sendFile(path.join(__dirname, '/public', 'apis.html'));
		});

app.get('/autenticazione',function(req,res,next){
		// Authentication on Firebase
		ref.authWithCustomToken(firebase_secret, function(error, authData) {
		
			if (error) console.log("Login Failed!", error);
			else{
				//console.log("Login Succeeded!");
			}
		
		});
	
        var code = req.query.code;
        var url = 'https://graph.facebook.com/v2.6/oauth/access_token?';
        
        // Getting access token using 'code'
        request.get({
			url: url,
            qs: {
                client_id: app_id,
				redirect_uri: 'http://localhost:8080/autenticazione',
				client_secret: app_secret,
                code: code
			}
        },function(error,response,body){
				if(!error && response.statusCode==200){
					var parsed = JSON.parse(body);
					access_token = parsed.access_token;

					var token        = '&access_token=' + access_token;
					var info_request = '=id,name,games,movies,books,music,birthday,friends,picture.type(large)';
					var fb_url       = 'https://graph.facebook.com/v2.6/me?fields';
					
					// Requesting user's likes to facebook
					request.get(fb_url.concat(info_request).concat(token), function(e, r, body) {
						if (!e && r.statusCode == 200) {
							var parsed = JSON.parse(body);

							req.fb_picture = parsed.picture.data.url;
							req.fb_id = parsed.id;
							req.fb_name = parsed.name;
							req.b_date = parsed.birthday;

							// Storing user's name and birthday
							var usersRef = ref.child("registered_users/" + req.fb_id);
							usersRef.set({Birthday: req.b_date, Username: req.fb_name});
							
							// Storing access_token
							ref.child("registered_users/" + req.fb_id + "/access_token").set({
								Token: access_token,
								Timestamp: new Date().getTime()
							});

							// Storing friends
							if (parsed.friends != undefined) {
								req.friends_list = parsed.friends.data;
								for (i = 0; i < req.friends_list.length; i++) {
									ref.child("registered_users/" + req.fb_id + "/friends_list/" + req.friends_list[i].id).set({
										Username: req.friends_list[i].name
									});
								}
							}

							// Storing music
							if (parsed.music != undefined) {
								req.music_likes = parsed.music.data;
								for (i = 0; i < req.music_likes.length; i++) {
									ref.child("registered_users/" + req.fb_id + "/music_likes/" + req.music_likes[i].id).set({
										Name: req.music_likes[i].name
									});
								}
							}

							// Storing books
							if (parsed.books != undefined) {
								req.books_likes = parsed.books.data;
								for (i = 0; i < req.books_likes.length; i++) {
									ref.child("registered_users/" + req.fb_id + "/books_likes/" + req.books_likes[i].id).set({
										Name: req.books_likes[i].name
									});
								}
							}

							// Storing movies
							if (parsed.movies != undefined) {
								req.movies_likes = parsed.movies.data;
								for (i = 0; i < req.movies_likes.length; i++) {
									ref.child("registered_users/" + req.fb_id + "/movies_likes/" + req.movies_likes[i].id).set({
										Name: req.movies_likes[i].name
									});
								}
							}

							// Storing games
							if (parsed.games != undefined) {
								req.games_likes = parsed.games.data;
								for (i = 0; i < req.games_likes.length; i++) {
									ref.child("registered_users/" + req.fb_id + "/games_likes/" + req.games_likes[i].id).set({
										Name: req.games_likes[i].name
									});
								}
							}
						}
						else console.log("error =" + e + "\nstatus code =" +r.statusCode + "\n_\n" + body);
						next();
					});
                }});
}, function(req, res, next){
	var games_array = [], music_array = [], movies_array = [], books_array = [], friends_array = [], friends_id_array = [];
	if (req.games_likes != undefined){
		for (var i=0; i<req.games_likes.length; i++)  games_array.push(req.games_likes[i].name);
	}
	if (req.books_likes != undefined){
		for (var i=0; i<req.books_likes.length; i++)  books_array.push(req.books_likes[i].name);
	}
	if (req.music_likes != undefined){
		for (var i=0; i<req.music_likes.length; i++)  music_array.push(req.music_likes[i].name);
	}
	if (req.movies_likes != undefined){
		for (var i=0; i<req.movies_likes.length; i++) movies_array.push(req.movies_likes[i].name);
	}
	if (req.friends_list != undefined){
		for (var i=0; i<req.friends_list.length; i++) friends_array.push(req.friends_list[i].name);
	}
	if (req.friends_list != undefined){
		for (var i=0; i<req.friends_list.length; i++) friends_id_array.push(req.friends_list[i].id);
	}

	req.session.logged_friends_list = friends_array;
	req.session.logged_friends_id   = friends_id_array;
	req.session.logged_id           = req.fb_id;
	req.session.logged_picture      = req.fb_picture;
	req.session.logged_name         = req.fb_name;

	res.redirect("/friends");
});

app.get('/friends',function(req,res,next){
	res.render('pages/friends', {
		friends_list:    req.session.logged_friends_list,
		friends_id_list: req.session.logged_friends_id,
		fb_name:         req.session.logged_name,
		fb_id:           req.session.logged_id,
		fb_picture:      req.session.logged_picture
	});
});

app.get('/:id/homepage',function(req,res,next){
	//Download dati utente :id
	var firebase = "https://apprc.firebaseio.com/";
	var f_path   = "registered_users/"+req.params.id+".json";
	var f_auth   = "?auth="+firebase_secret;

	request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
		var parsed = JSON.parse(body);

		if (parsed != null) {
			req.fb_id = req.params.id;
			req.fb_name = parsed.Username;
			req.b_date = parsed.Birthday;

			if (parsed.friends_list != undefined) {
				req.friends_list = parsed.friends_list;
			}

			if (parsed.music_likes != undefined) {
				req.music_likes = parsed.music_likes;
			}

			if (parsed.books_likes != undefined) {
				req.books_likes = parsed.books_likes;
			}

			if (parsed.movies_likes != undefined) {
				req.movies_likes = parsed.movies_likes;
			}

			if (parsed.games_likes != undefined) {
				req.games_likes = parsed.games_likes;
			}
		}
		next();
	});

}, function(req, res, next){
	var games_array = [], music_array = [], movies_array = [], books_array = [], friends_array = [], friends_id_array = [];
	if (req.games_likes != undefined){
		for (var i in req.games_likes){
			games_array.push(req.games_likes[i].Name);
		}
	}
	if (req.books_likes != undefined){
		for (var i in req.books_likes){
			books_array.push(req.books_likes[i].Name);
		}
	}
	if (req.music_likes != undefined){
		for (var i in req.music_likes){
			music_array.push(req.music_likes[i].Name);
		}
	}
	if (req.movies_likes != undefined){
		for (var i in req.movies_likes){
			movies_array.push(req.movies_likes[i].Name);
		}
	}

	res.render('pages/index', {
		fb_id:           req.fb_id,
		games_likes:     games_array,
		music_likes:     music_array,
		books_likes:     books_array,
		movies_likes:    movies_array
	});
});

app.get('/:id/new_likes',function(req,res,next){
	//Download dati utente :id
	var firebase = "https://apprc.firebaseio.com/";
	var f_path   = "registered_users/"+req.params.id+".json";
	var f_auth   = "?auth="+firebase_secret;
	
	var user_id = req.params.id;
	
	amqp.connect('amqp://rabbitmq', function(err, conn) {
		conn.createChannel(function(err, ch) {
			// Assert the exchange point
			ch.assertExchange('exchange_point_fp', 'direct');
			
			// Single category like queue
			var movies_queue = req.params.id + "_movies";
			var games_queue = req.params.id + "_games";
			var music_queue = req.params.id + "_music";
			var books_queue = req.params.id + "_books";
			
			ch.assertQueue(movies_queue);
			ch.assertQueue(games_queue);
			ch.assertQueue(music_queue);
			ch.assertQueue(books_queue);
			
			ch.bindQueue(movies_queue, "exchange_point_fp", movies_queue);
			ch.bindQueue(games_queue, "exchange_point_fp", games_queue);
			ch.bindQueue(music_queue, "exchange_point_fp", music_queue);
			ch.bindQueue(books_queue, "exchange_point_fp", books_queue);
			
			
			req.new_likes = [];
			
			
			ch.consume(movies_queue, function(msg){
				console.log(" [x] Received new movies like: " + msg.content);
				req.new_likes.push(msg.content);
			}, {noAck: true});
			
			ch.consume(games_queue, function(msg){
				console.log(" [x] Received new games like: " + msg.content);
				req.new_likes.push(msg.content);
			}, {noAck: true});
			
			ch.consume(music_queue, function(msg){
				console.log(" [x] Received new music like: " + msg.content);
				req.new_likes.push(msg.content);
			}, {noAck: true});
			
			ch.consume(books_queue, function(msg){
				console.log(" [x] Received new books like: " + msg.content);
				req.new_likes.push(msg.content);
			}, {noAck: true});
		});
		setTimeout(function() { conn.close(); next();}, 1000);
	});

}, function(req, res, next){
	
	var new_likes_array = [];
	if (req.new_likes != undefined){
		for (var i in req.new_likes){
			new_likes_array.push(req.new_likes[i]);
		}
	}

	res.render('pages/new_likes', {
		fb_id:		req.params.id,
		new_likes:	new_likes_array
	});
});

app.get('/:id/games',function(req,res,next){
	//Download dati utente :id
	var firebase = "https://apprc.firebaseio.com/";
	var f_path   = "registered_users/"+req.params.id+".json";
	var f_auth   = "?auth="+firebase_secret;

	request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
		var parsed = JSON.parse(body);

		if (parsed != null) {
			if (parsed.games_likes != undefined) {
				req.games_likes = parsed.games_likes;
			}
		}
		next();
	});
}, function(req, res, next){
	var games_array = [];
	if (req.games_likes != undefined){
		for (var i in req.games_likes){
			games_array.push(req.games_likes[i].Name);
		}
	}

	res.render('pages/games', {
		fb_id:       req.params.id,
		games_likes: games_array
	});
});

app.get('/:id/books',function(req,res,next){
	//Download dati utente :id
	var firebase = "https://apprc.firebaseio.com/";
	var f_path   = "registered_users/"+req.params.id+".json";
	var f_auth   = "?auth="+firebase_secret;

	request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
		var parsed = JSON.parse(body);

		if (parsed != null) {
			if (parsed.books_likes != undefined) {
				req.books_likes = parsed.books_likes;
			}
		}
		next();
	});

}, function(req, res, next){
	var books_array = [];
	if (req.books_likes != undefined){
		for (var i in req.books_likes){
			books_array.push(req.books_likes[i].Name);
		}
	}

	res.render('pages/books', {
		fb_id:       req.params.id,
		books_likes: books_array
	});
});

app.get('/:id/movies',function(req,res,next){
	//Download dati utente :id
	var firebase = "https://apprc.firebaseio.com/";
	var f_path   = "registered_users/"+req.params.id+".json";
	var f_auth   = "?auth="+firebase_secret;

	request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
		var parsed = JSON.parse(body);

		if (parsed != null) {
			if (parsed.movies_likes != undefined) {
				req.movies_likes = parsed.movies_likes;
			}
		}
		next();
	});

}, function(req, res, next){
	var movies_array = [];
	if (req.movies_likes != undefined){
		for (var i in req.movies_likes){
			movies_array.push(req.movies_likes[i].Name);
		}
	}

	res.render('pages/movies', {
		fb_id:        req.params.id,
		movies_likes: movies_array
	});
});

app.get('/:id/music',function(req,res,next){
	//Download dati utente :id
	var firebase = "https://apprc.firebaseio.com/";
	var f_path   = "registered_users/"+req.params.id+".json";
	var f_auth   = "?auth="+firebase_secret;

	request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
		var parsed = JSON.parse(body);

		if (parsed != null){
			if (parsed.music_likes != undefined) {
				req.music_likes = parsed.music_likes;
			}
		}
		next();
	});

}, function(req, res, next){
	var music_array = [];
	if (req.music_likes != undefined){
		for (var i in req.music_likes){
			music_array.push(req.music_likes[i].Name);
		}
	}

	res.render('pages/music', {
		fb_id:       req.params.id,
		music_likes: music_array
	});
});

var server = app.listen(8080, function() {
	var port = server.address().port;
 	console.log('Listening on port: ', port);
 	
 	notificationHandler();
} );
 	
 	
 	
 function notificationHandler(){
 	// Authentication on Firebase
	ref.authWithCustomToken(firebase_secret, function(error, authData) {
		if (error) console.log("Login Failed!", error);
		else{
			console.log("Checking new likes....");
		}
	});
	
	var ref_users = ref.child("registered_users");
	ref_users.orderByChild("Username").on("child_added", function(snapshot){
		var user_id = snapshot.key();
		
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users/" + user_id + "/access_token.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			if(parsed != undefined){
				var timestamp = parsed.Timestamp;
				var user_token = parsed.Token;
				var now = new Date().getTime();
				var token_life = 30*24*60*60*1000; // 1 month
				
				if (now - timestamp > token_life){
					// access_token has expired
					console.log("Token has expired");
					return;
				}
				
				
				const info_request = '=games,movies,books,music&access_token=';
				const fb_url       = 'https://graph.facebook.com/v2.5/me?fields';
					
				request.get(fb_url.concat(info_request).concat(user_token), function(e, r, body){
					if (!e && r.statusCode == 200) {
						var parsed = JSON.parse(body);
						
						var music_likes;
						var movies_likes;
						var books_likes;
						var games_likes;
						
						// Checking new music
						if (parsed.music != undefined) {
							music_likes  = parsed.music.data;
							
							for (var i in music_likes){
								f_path   = "registered_users/" + user_id + "/music_likes/" + music_likes[i].id + ".json";
								
								database_check(firebase, f_path, f_auth, music_likes[i].id, music_likes[i].name, "music", user_id);
								
							}
						}
						// Checking new movies
						if (parsed.movies != undefined) {
							movies_likes  = parsed.movies.data;
							
							for (var i in movies_likes){
								f_path   = "registered_users/" + user_id + "/movies_likes/" + movies_likes[i].id + ".json";
								
								database_check(firebase, f_path, f_auth, movies_likes[i].id, movies_likes[i].name, "movies", user_id);
							}
						}
						// Checking new games
						if (parsed.games != undefined) {
							games_likes  = parsed.games.data;
							
							for (var i in games_likes){
								f_path   = "registered_users/" + user_id + "/games_likes/" + games_likes[i].id + ".json";
								
								database_check(firebase, f_path, f_auth, games_likes[i].id, games_likes[i].name, "games", user_id);
							}
						}
						// Checking new books
						if (parsed.books != undefined) {
							books_likes  = parsed.books.data;
							
							for (var i in books_likes){
								f_path   = "registered_users/" + user_id + "/books_likes/" + books_likes[i].id + ".json";
								
								database_check(firebase, f_path, f_auth, books_likes[i].id, books_likes[i].name, "books", user_id);
								
							}
						}
					}
					else console.log("facebook: connection error");
				});
			}
			
		});
		
	});
	
	setTimeout(function(){notificationHandler();}, 10000);
}
 	
function database_check(firebase, f_path, f_auth, id, name, type, user_id){
	
	request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
		if (body == undefined) {
			console.log("body undefined");
			return;
		}
		
		var like = JSON.parse(body);
		if(like == undefined){
			// This is a new Like
			amqp.connect('amqp://rabbitmq', function(err, conn) {
				conn.createChannel(function(err, ch) {
					
					ch.assertExchange('exchange_point_fp', 'direct');
					
					// Sending new like
					ch.publish('exchange_point_fp', user_id + "_" + type, new Buffer(name),{ persistent: true, expiration: 24*60*1000 });
					console.log(" [x] " + type + ": '%s' sent to: '%s'", name, user_id);
					
					ref.child("registered_users/" + user_id + "/" + type + "_likes/" + id).set({
						Name: name
					});
					
					
				});
				setTimeout(function() { conn.close();}, 500);
			});
			
		}
	});
}
 	

app.get('/api/friend_birthday',function(req,res,next){
	if (req.query.id == undefined || req.query.id == '' || req.query.friend == undefined || req.query.friend == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					for (var db_friend in parsed[db_id].friends_list) {
						if (db_friend == api_friend){
							// api_friend is in database
							res.json({status : 'ok', birthday : parsed[api_friend].Birthday});
							return;
						}
					}
					res.json({status : 'error', birthday : ''});
					return;
				}
			}
			res.json({status : 'error', birthday : ''});
			return;
		});
	}
});

app.get('/api/friend_movies',function(req,res,next){
	if (req.query.id == undefined || req.query.id == '' || req.query.friend == undefined || req.query.friend == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					for (var db_friend in parsed[db_id].friends_list) {
						if (db_friend == api_friend){
							// api_friend is in database
							res.json({status : 'ok', movies : parsed[api_friend].movies_likes});
							return;
						}
					}
					res.json({status : 'error', movies : 'undefined'});
					return;
				}
			}
			res.json({status : 'error', movies : 'undefined'});
			return;
		});
	}
});

app.get('/api/friend_games',function(req,res,next){
	if (req.query.id == undefined || req.query.id == '' || req.query.friend == undefined || req.query.friend == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					for (var db_friend in parsed[db_id].friends_list) {
						if (db_friend == api_friend){
							// api_friend is in database
							res.json({status : 'ok', games : parsed[api_friend].games_likes});
							return;
						}
					}
					res.json({status : 'error', games : 'undefined'});
					return;
				}
			}
			res.json({status : 'error', games : 'undefined'});
			return;
		});
	}
});

app.get('/api/friend_music',function(req,res,next){
	if (req.query.id == undefined || req.query.id == '' || req.query.friend == undefined || req.query.friend == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					for (var db_friend in parsed[db_id].friends_list) {
						if (db_friend == api_friend){
							// api_friend is in database
							res.json({status : 'ok', music : parsed[api_friend].music_likes});
							return;
						}
					}
					res.json({status : 'error', music : 'undefined'});
					return;
				}
			}
			res.json({status : 'error', music : 'undefined'});
			return;
		});
	}
});

app.get('/api/friend_books',function(req,res,next){
	if (req.query.id == undefined || req.query.id == '' || req.query.friend == undefined || req.query.friend == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					for (var db_friend in parsed[db_id].friends_list) {
						if (db_friend == api_friend){
							// api_friend is in database
							res.json({status : 'ok', books : parsed[api_friend].books_likes});
							return;
						}
					}
					res.json({status : 'error', books : 'undefined'});
					return;
				}
			}
			res.json({status : 'error', books : 'undefined'});
			return;
		});
	}
});

app.get('/api/friend_likes',function(req,res,next){
	if (req.query.id == undefined || req.query.id == '' || req.query.friend == undefined || req.query.friend == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					for (var db_friend in parsed[db_id].friends_list) {
						if (db_friend == api_friend){
							// api_friend is in database
							res.json({status : 'ok', movies : parsed[api_friend].movies_likes, music : parsed[api_friend].music_likes, games : parsed[api_friend].games_likes, books : parsed[api_friend].books_likes} );
							return;
						}
					}
					res.json({status : 'error', movies : 'undefined', music : 'undefined', games : 'undefined', books : 'undefined'});
					return;
				}
			}
			res.json({status : 'error', movies : 'undefined', music : 'undefined', games : 'undefined', books : 'undefined'});
			return;
		});
	}
});

app.get('/api/user_birthday',function(req,res,next){
	if (req.query.id == undefined || req.query.id == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					res.json({status : 'ok', birthday : parsed[api_id].Birthday});
					return;
				}
			}
			res.json({status : 'error', birthday : ''});
			return;
		});
	}
});

app.get('/api/user_movies',function(req,res,next){
	if (req.query.id == undefined || req.query.id == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					res.json({status : 'ok', movies : parsed[api_id].movies_likes});
					return;
				}
			}
			res.json({status : 'error', movies : 'undefined'});
			return;
		});
	}
});

app.get('/api/user_music',function(req,res,next){
	if (req.query.id == undefined || req.query.id == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					res.json({status : 'ok', music : parsed[api_id].music_likes});
					return;
				}
			}
			res.json({status : 'error', music : 'undefined'});
			return;
		});
	}
});

app.get('/api/user_games',function(req,res,next){
	if (req.query.id == undefined || req.query.id == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					res.json({status : 'ok', games : parsed[api_id].games_likes});
					return;
				}
			}
			res.json({status : 'error', games : 'undefined'});
			return;
		});
	}
});

app.get('/api/user_books',function(req,res,next){
	if (req.query.id == undefined || req.query.id == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					res.json({status : 'ok', books : parsed[api_id].books_likes});
					return;
				}
			}
			res.json({status : 'error', books : 'undefined'});
			return;
		});
	}
});

app.get('/api/user_likes',function(req,res,next){
	if (req.query.id == undefined || req.query.id == ''){
		res.json({status : 'error', birthday : ''});
	}
	else{
		var api_id = req.query.id;
		var api_friend = req.query.friend;
		var firebase = "https://apprc.firebaseio.com/";
		var f_path   = "registered_users.json";
		var f_auth   = "?auth="+firebase_secret;
		
		request.get(firebase.concat(f_path).concat(f_auth), function(e, r, body) {
			var parsed = JSON.parse(body);
			
			for (var db_id in parsed) {
				if(db_id == api_id){
					// api_id is in database
					res.json({status : 'ok', movies : parsed[api_id].movies_likes, music : parsed[api_id].music_likes, games : parsed[api_id].games_likes, books : parsed[api_id].books_likes} );
					return;
				}
			}
			res.json({status : 'error', movies : 'undefined', music : 'undefined', games : 'undefined', books : 'undefined'});
			return;
		});
	}
});
