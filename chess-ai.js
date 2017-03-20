// Taken from azer at: https://gist.github.com/azer/889174

/**
 * > require('chess-ai.js').search(new require('chess.js').Chess);
 * 'd5'
 */
 
var MAX_SEARCH_DEPTH_LIMIT = 3;
var MAX_SEARCH_TIME_LIMIT = 500; // ms

var values = { 
  'pieces':{ 'p':33, 'r':41, 'n':37, 'b':37, 'q':45, 'k':49 },
  'ranks':[undefined,1,2,4,4,4,4,2,1],
  'files':{ 'a':1, 'b': 1, 'c':1, 'd':2, 'e':2, 'f':1, 'g':1, 'h':1 }
};

var searchStartTS;

function evalBoard(ctx, color){
  return score(ctx, color) - score(ctx, opponent(color));
}

function evalMove(ctx, move, depth, color){
  !depth && ( depth = 0 );

  var max, min, value, moves, capture, captureVal;

  value = evalPiece(move.piece);

  if( move.color == color && ctx.attacked( opponent(color),  ctx.SQUARES[move.to] ) ){
    capture = ctx.get(move.to);
    captureVal = capture && evalPiece(capture);
    if(!capture || captureVal<value){
      return ( capture ? captureVal : 0 )-value;
    }   
  }

  ctx.move(move.san);

  moves = ctx.moves({ 'verbose':true }); 

  var i, len, el; 
  for(i = -1, len=moves.length; ++i < len; ){
    if(depth+1<MAX_SEARCH_DEPTH_LIMIT && (new Date).getTime()-searchStartTS<MAX_SEARCH_TIME_LIMIT){
      el = evalMove(ctx, moves[i], depth+1, color); 
    } else {
      ctx.move(moves[i].san);
      el = evalBoard(ctx, color);
      ctx.undo();
    }   

    ( !max || el>max ) && ( max = el );
    ( !min || el<min ) && ( min = el );
  };  

  ctx.undo();

  return ctx.turn() != color ? max : min;
}

function evalPiece(piece){
  return values.pieces[piece.toLowerCase()];
}

function evalSquare(ctx, square, color){
  var value = 0,
      file = square.charAt(0),
      rank = square.charAt(1),

      locValue = values.ranks[rank] + values.files[file],

      piece = ctx.get(square),
      pieceVal = piece && evalPiece(piece),
      ownPiece = piece && ( color == piece.toUpperCase()==piece && 'w' || 'b' ),
      oppPiece = piece && !ownPiece,

      oppAttack = ctx.attacked(opponent(color), ctx.SQUARES[square]),
      ownAttack = ctx.attacked(color, ctx.SQUARES[square]);

  value += ( ownPiece && ( !oppAttack || ownAttack ) ) && ( pieceVal ) || 0;

  value += ( !piece && ownAttack && !oppAttack ) && locValue || 0;
  value -= ( !piece && oppAttack && !ownAttack ) && locValue || 0;

  value += ( oppPiece && !oppAttack && ownAttack ) && pieceVal || 0;
  value -= ( ownPiece && oppAttack ) && pieceVal || 0;

  return value;
}

function opponent(color){
  return color=='w' && 'b' || 'w';
}

function score(ctx,color){
  var ret = 0,
      pieces = ctx.fen().replace(/\s.*/,'').match(color == 'b' && /[prnbqk]/g || /[PRNBGQK]/g);

  var i, len;
  for(i = -1, len=pieces.length; ++i < len; ){
    ret += values.pieces[ pieces[i].toLowerCase() ];

    ret += values.pieces[ pieces[i].toLowerCase() ];
  };

  for(square in ctx.SQUARES){
    ret += evalSquare(ctx, square, color);
  }

  return ret;
}

function search(ctx){
  var moves = ctx.moves({ 'verbose':true });

  searchStartTS = (new Date).getTime();

  var i, len, el, min, max, best;
  for(i = -1, len=moves.length; ++i < len;){
    el = evalMove(ctx, moves[i], 1, ctx.turn());
    ( !max || el > max[0] ) && ( max = [ el, moves[i] ] );
  };

  return max[1].san;
}

function setSearchTimeLimit(ms){
  MAX_SEARCH_TIME_LIMIT = ms;
}

module.exports = {
  'score':score,
  'search':search,
  'setSearchTimeLimit':setSearchTimeLimit
}