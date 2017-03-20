/*
	Chessbot
	Copyright (C) 2017 Subtixx (Dominic H.)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var restify = require('restify');
var builder = require('botbuilder');
var Jimp = require("jimp");
var Chess = require('chess.js').Chess;

var botEnabled = true;

// TODO: Make group conversations into a group chessgame.

//=========================================================
// Bot Setup
//=========================================================
if(botEnabled)
{
	// Setup Restify Server
	var server = restify.createServer();
	server.listen(process.env.port || process.env.PORT || 3978, function () {
	   console.log('%s listening to %s', server.name, server.url); 
	});
	  
	// Create chat bot
	var connector = new builder.ChatConnector({
		appId: process.env.MICROSOFT_APP_ID,
		appPassword: process.env.MICROSOFT_APP_PASSWORD
	});

	var bot = new builder.UniversalBot(connector);
	server.post('/api/messages', connector.listen());

	bot.beginDialogAction('newGame', '/newGame', { matches: /^new game/i });
	bot.beginDialogAction('endGame', '/endGame', { matches: /(give up|quit|goodbye)/i });
	bot.beginDialogAction('help', '/help', { matches: /(help|what)/i });
	bot.beginDialogAction('status', '/status', { matches: /^status/i });
	bot.beginDialogAction('move', '/move', { matches: /^move/i });
}

//=========================================================
// Chess Setup
//=========================================================
var rebuildChessboard = false;

var chessboardImg;

var boardWhite;
var boardBlack;

var boardCorner = [];

var boardFont;
var boardFont2;

/*
white = White
 - p -> Pawn / Bauer
 - r -> Rook / Turm
 - n -> Knight / Pferd
 - b -> Bishop / Springer
 - q -> Queen / Dame
 - k -> King / König
black = Black
 - p -> Pawn / Bauer
 - r -> Rook / Turm
 - n -> Knight / Pferd
 - b -> Bishop / Springer
 - q -> Queen / Dame
 - k -> King / König
*/
var pieces = [];

//var chess = new Chess();
var currentBoard;

function RebuildChessboard()
{
	if(rebuildChessboard)
	{
		// Build a 10 x 10 chessboard
		new Jimp(320, 320, 0x000, function (err, image) {
			//image.blit( src, x, y[, srcx, srcy, srcw, srch] );
			
			image.blit(boardCorner["LT"], 0, 0);			
			image.blit(boardCorner["RT"], 288, 0);
			
			for(var i = 1; i < 9; i++)
			{ // Fill borders
				image.blit(boardCorner["MT"], i*32, 0);
				image.blit(boardCorner["LM"], 0, i*32);
				image.blit(boardCorner["RM"], 288, i*32);
				image.blit(boardCorner["MB"], i*32, 288);
			}
			
			var white = true;
			for(var x = 0; x < 8; x++){
				for(var y = 0; y < 8; y++){
					if(white)
						image.blit(boardWhite, 32+x*32, 32+y*32);
					else
						image.blit(boardBlack, 32+x*32, 32+y*32);
					white = !white;
				}
				white = !white;
			}
			
			image.blit(boardCorner["LB"], 0, 288);
			image.blit(boardCorner["RB"], 288, 288);
			
			chessboardImg = image.clone();
			image.write("chessboard.png");
		});
	}
}

function DrawCurrentBoard(session = null, send = false)
{
	session.sendTyping(); // Let the user know we're generating his image right now.
	
	new Jimp(352, 352, Jimp.rgbaToInt(0, 0, 0, 0), function (err, image) {
		image.blit(chessboardImg, 32, 32);
		
		var chess = new Chess(session.userData.chess);
		var board = chess.board();
		for(var x = 0; x < board.length; x++)
		{
			// TODO: This is so stupid. We should have an already made texture with labeling.
			image.print(boardFont2, 72+x*32, 1, String.fromCharCode('a'.charCodeAt()+x));
			image.print(boardFont, 71+x*32, 0, String.fromCharCode('a'.charCodeAt()+x));
			for(var y = 0; y < board[x].length; y++)
			{				
				image.print(boardFont2, 9, 65+y*32, (8-y).toString());
				image.print(boardFont, 8, 64+y*32, (8-y).toString());
				if(board[y][x] == null) // Skip empty places
					continue;
				//console.log("X: " + x + " Y: " + y);
				//console.log(board[y][x]);
					
				if(board[y][x]["color"] == "w")
					image.composite(pieces["white"][board[y][x]["type"]], 64+x*32, 32+y*32);
				else
					image.composite(pieces["black"][board[y][x]["type"]], 64+x*32, 32+y*32);
			}
		}
		
		image.getBase64(Jimp.MIME_PNG, function (err, encodedImg) { 			
			if(send)
			{
				var msg = new builder.Message(session)
				.attachments([{
					contentType: "image/jpeg",
					contentUrl: encodedImg
				}]);
				session.send(msg);
			}
		});
		
		//image.write("temp/chess.jpg");
	});
}

function ValidateSession(session)
{
	if(session.userData.chess == "" || !(new Chess().validate_fen(session.userData.chess)["valid"]))
	{
		session.send("No game running! Type 'new game' to start a new game!");
		session.endDialog();
		return false;
	}
	
	return true;
}

function Move(session = null, send = false, move = null)
{
	if(!ValidateSession(session))
		return;
	
	var chess = new Chess(session.userData.chess);
	var moveRes = chess.move({ from: move[0], to: move[1] }); // Move user choice!
	if(moveRes != null)
	{
		// Make bot move here
		var moves = chess.moves({ verbose: true });
		var move = moves[Math.floor(Math.random() * moves.length)];
		
		session.send("I'm moving from " + move["from"] + " to " + move["to"]);
		chess.move(move);
		
		// Save fen to usersession
		session.userData.chess = chess.fen();
		DrawCurrentBoard(session, true);
	}else{
		if(chess.get(move[0])["color"] == "b")
		{
			session.send("This piece doesn't belong to you! (You're white. Piece is black)");
			session.endDialog();
			return;
		}
		var availableMoves = chess.moves({square: move[0]});
		if(availableMoves != null && availableMoves != undefined && availableMoves >= 1){
			var movesAvailable = availableMoves[0];
			if(availableMoves.length > 1){
				for(var i = 1; i < availableMoves.length; i++)
					movesAvailable = movesAvailable + "," + availableMoves[i];
			}
			
			session.send("This would be an illegal move. You could try to move from " + move[0] + " to one of the following: " + movesAvailable);
		}else{
			session.send("This would be an illegal move. This piece doesn't have any move option.");
		}
	}
	
	if(chess.game_over())
	{
		session.send("Game over! "+ (chess.turn() == "b") ? "You won":"I won");
		session.userData.chess = "";
	}
	session.endDialog();
}

function PiecesLoaded()
{
	RebuildChessboard();
	
	if(botEnabled)
	{
		bot.on('contactRelationUpdate', function (message) {
			if (message.action === 'add') {
				var name = message.user ? message.user.name : null;
				var reply = new builder.Message()
						.address(message.address)
						.text("Hello %s... Thanks for adding me. Type 'new game' to start a new game of chess!", name || 'there');
				bot.send(reply);
			} else {
				session.userData.chess = "";
				// delete their data
			}
		});
		
		bot.dialog('/', function(session){
			if(session.userData.chess != "")
			{
				var moves = session.message.text.split(" ");
				if(moves.length == 2)
				{
					Move(session, true, moves);
					
				}else{
					session.send("I don't understand sorry. (Type for example 'e2 e3' to move from e2 to e3");
				}
			}else{			
				session.send("Hello! I'm Chessbot written by Subtixx! The following commands are available:");
				session.send("'new game', 'move', 'status', 'from to'");
			}
			session.endDialog();
		});
		
		bot.dialog('/help', function(session){
			session.send("For more help please visit my Github page!");
			
			var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                    .title("ChessBot Github Page")
                    .subtitle("Written by Subtixx")
                    .text("Chessbot is a bot written in Javascript for Node.JS and uses the BotBuilder SDK. It was written to play chess in skype. It generates a visual layout of the chessboard using jimp")
                    .images([
                        builder.CardImage.create(session, "https://raw.githubusercontent.com/Subtixx/Chessbot/master/logo.png")
                    ])
                    .tap(builder.CardAction.openUrl(session, "https://github.com/Subtixx/Chessbot"))
            ]);
			session.send(msg);
		});
		
		bot.dialog('/newGame', function(session){
			session.userData.chess = new Chess().fen();
			DrawCurrentBoard(session, true);
			
			session.endDialog();
		});
		
		bot.dialog('/endGame', function(session){
			session.userData.chess = "";
			
			session.send("HaHa that means I win! Thank you for playing!");
			
			session.endDialog();
		});
		
		bot.dialog('/status', function (session) {
			if(!ValidateSession(session))
				return;
			
			DrawCurrentBoard(session, true);
			session.endDialog();			
		});
		
		bot.dialog('/move', [
			function(session) {
				if(!ValidateSession(session))
					return;
				
				if(new Chess(session.userData.chess).turn() == "w")
					builder.Prompts.text(session, 'How do you want to move?');
				else{
					session.send("Not your turn!");
					session.endDialog();
				}
			},

			function(session, results) {
				var moves = results.response.split(" ");
				if(moves.length == 2)
				{
					Move(session, true, moves);
				}else{
					session.send("I didn't understand, sorry.");
				}
				session.endDialog();
				console.log(results);
			}
		]);
	}else{
		DrawCurrentBoard();
	}
}

Jimp.loadFont(Jimp.FONT_SANS_32_BLACK).then(function (font) {
	boardFont2 = font;
	Jimp.loadFont(Jimp.FONT_SANS_32_WHITE).then(function (font) {
		boardFont = font;
		
		Jimp.read("images/chess_pieces.png", function (err, lenna) {
			if (err) throw err;
			pieces["white"] = [];
			pieces["white"]["p"] = lenna.clone().crop(0, 0, 32, 64);
			pieces["white"]["r"] = lenna.clone().crop(32, 0, 32, 64);
			pieces["white"]["n"] = lenna.clone().crop(64, 0, 32, 64);
			pieces["white"]["b"] = lenna.clone().crop(96, 0, 32, 64);
			pieces["white"]["q"] = lenna.clone().crop(128, 0, 32, 64);
			pieces["white"]["k"] = lenna.clone().crop(160, 0, 32, 64);
			
			pieces["black"] = [];
			pieces["black"]["p"] = lenna.clone().crop(0, 64, 32, 64);
			pieces["black"]["r"] = lenna.clone().crop(32, 64, 32, 64);
			pieces["black"]["n"] = lenna.clone().crop(64, 64, 32, 64);
			pieces["black"]["b"] = lenna.clone().crop(96, 64, 32, 64);
			pieces["black"]["q"] = lenna.clone().crop(128, 64, 32, 64);
			pieces["black"]["k"] = lenna.clone().crop(160, 64, 32, 64);		
			
			if(rebuildChessboard)
			{
				Jimp.read("images/chess_background.png", function (err, lenna) {
					boardWhite = lenna.clone().crop(0, 0, 32, 32);
					boardBlack = lenna.clone().crop(0, 32, 32, 32);
					
					boardCorner["LT"] = lenna.clone().crop(32, 0, 32, 32);
					boardCorner["MT"] = lenna.clone().crop(64, 0, 32, 32);
					boardCorner["RT"] = lenna.clone().crop(96, 0, 32, 32);
					
					boardCorner["LM"] = lenna.clone().crop(32, 32, 32, 32);
					boardCorner["MM"] = lenna.clone().crop(64, 32, 32, 32);
					boardCorner["RM"] = lenna.clone().crop(96, 32, 32, 32);
					
					boardCorner["LB"] = lenna.clone().crop(32, 64, 32, 32);
					boardCorner["MB"] = lenna.clone().crop(64, 64, 32, 32);
					boardCorner["RB"] = lenna.clone().crop(96, 64, 32, 32);
					
					PiecesLoaded();
				});
			}else{
				Jimp.read("images/chessboard.png", function (err, lenna) {
					chessboardImg = lenna.clone();
					
					PiecesLoaded();
				});
			}
		});
	});
});