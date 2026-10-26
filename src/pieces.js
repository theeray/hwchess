// The traditional Neo set matches the user-provided piece reference.
// Assets are served locally so games do not depend on a third-party image host.
export function pieceIcon(type,color){
 if(!'pnbrqk'.includes(type)||!['w','b'].includes(color))return '';
 return `<img class="chess-piece" src="/pieces/neo/${color}${type}.png" width="150" height="150" alt="" aria-hidden="true" draggable="false">`;
}
