import { jws, KEYUTIL } from 'jsrsasign';
import { readFile } from 'jsrsasign-util';

var algorithm = 'RS256';
var header = JSON.stringify({ alg: algorithm });
var payload = `{
    "iss": "fsdfs"
  }`;

var priv = readFile('./rsa.priv');
var prvKey = KEYUTIL.getKey(priv);
var JWS = jws.JWS.sign(algorithm, header, payload, prvKey);

console.log('JWS:', JWS);

var pub = readFile('./rsa.pub');
var pubKey = KEYUTIL.getKey(pub);
var isValid = jws.JWS.verify(JWS, pubKey, [algorithm]);

console.log('Verified:', isValid);
