# Open Banking Message Signing

## Message Signing

The Payment Initiation APIs in UK Open Banking mandate that from version 3.0 and above all inbound requests must be digitally signed by the API consumer and all responses likewise must be signed by the API provider. Ultimately this is to meet a non-repudiation requirement whereby both parties can assure themselves that the request and responses originated by the private key holder and no message tampering has occurred somewhere in the connection (although unlikely due to Mutual TLS for transport security, message signing simplifies the records management aspects).

## JSON Web Signatures

The Open Banking Implementation Entity (the UK body responsible for facilitating the API specification authoring) has mandated that JSON Web Signatures (JWS) will be used to communicate the signature as part of the HTTP request/responses. These are standardised as part of RFC 7515.

A JSON Web Signature is a simple format:

```
base64Encode(header) + "." + base64Encode(payload) + "." + base64Encode(signature)
```

The **header** contains parameters holding meta data about the **signature** (e.g. algorithm for signing, the id of the key pair used etc.), the payload contains the actual content to be signed and the **signature** is the cipher text from enciphering the header and payload together.

### Detached Signatures

In the context of Open Banking message signing, the **payload** of the JWS is the full HTTP body (that is, sans HTTP headers). The signature is provided in a custom HTTP header **x-jws-signature**. Using the HTTP message body as the **payload** is great for message signing purposes, but leads to an almost doubling of the HTTP message size due to duplicating the HTTP body into a HTTP header. There are two ways to overcome this, either avoid using the header and modify the HTTP body to contain the JWS or adopt detached JWS.

Open Banking opted for the detached signature option because:

- it avoids obfuscating request/response bodies by wrapping them in a JWS envelope
- request/responses that provide a malformed x-jws-signature header can be rejected before ever reading the full HTTP body
- implementers are given more options to keep the message signing away from their business logic as the HTTP body needs no manipulation

A **detached** JWS is simply one where the **payload** is removed and provided elsewhere (for Open Banking purposes the payload is provided in the HTTP body). **Detached** JWS are described in Appendix F of the RFC and are not something supported in any of the Java libraries we have tried. In actuality the RFC specifically states that the input and output of the library should be manually modified by the application code. In Java, the modification is relatively straight forward, all you need to do is simply strip the payload portion of the JWS out. The following Java snippet shows how.

```java
private String createDetachedJws(String serializedJws) {
  String[] jwsParts = StringUtils.split(serializedJws, ".");

  return jwsParts[0] + ".." + jwsParts[2];
}
```

To demonstrate, take the following attached JWS and deserialize it in https://jwt.io:

`eyJiNjQiOmZhbHNlLCJodHRwOlwvXC9vcGVuYmFua2luZy5vcmcudWtcL2lhdCI6MTU0MzU4NzI2MiwiY3JpdCI6WyJiNjQiLCJodHRwOlwvXC9vcGVuYmFua2luZy5vcmcudWtcL2lhdCIsImh0dHA6XC9cL29wZW5iYW5raW5nLm9yZy51a1wvaXNzIl0sImtpZCI6Im5XTmpvQlZtRkVoa0VJLVlQbWdPWGxUbmlUVSIsInR5cCI6IkpPU0UiLCJodHRwOlwvXC9vcGVuYmFua2luZy5vcmcudWtcL2lzcyI6IkM9R0IsIE89T3BlbkJhbmtpbmcsIE9VPTAwMTU4MDAwMDFaRVozV0FBWCwgQ049NHRIQ0ZZemhtUlRwNWVkN1RyNUlONiIsImFsZyI6IlJTMjU2In0.eyJoZWxsbyI6IndvcmxkIn0.KFmPmaOf3FwYLoOL2IjzhG00LMBCFOPQPOofOH21SIUKAmMmtuB8yccltLFT4lZ5m8EG0Yg9PFc1bbHQtZCwgoVGW9N8hzx5eNJ4sHJp6yIAo2QpXIyukKkRhnoxCvJVmi4hgkFW7pkVLDvOXTg8QORtf7ZEXD86ACCGE5KKq6d6jXnRYUmUusDBlDw0IhWyfvzfTL6Jhhe3Q9wYDlcGH5vvZgfJiRAOnDRw7rDDJ79hDJbP_CH1Jkj5yhGN1MthuSIdCXrM5BAqSZ5VRrNojgMI29FApIP_TMCzWzHKBysjIovtAJnPF3jBjQdChruEGK3PPl5DV3W6HucOtDfU4g`

As you’ll see it contains a simple payload:

```json
{
  "hello": "world"
}
```

Following **detachment**, it will become:

`eyJiNjQiOmZhbHNlLCJodHRwOlwvXC9vcGVuYmFua2luZy5vcmcudWtcL2lhdCI6MTU0MzU4NzI2MiwiY3JpdCI6WyJiNjQiLCJodHRwOlwvXC9vcGVuYmFua2luZy5vcmcudWtcL2lhdCIsImh0dHA6XC9cL29wZW5iYW5raW5nLm9yZy51a1wvaXNzIl0sImtpZCI6Im5XTmpvQlZtRkVoa0VJLVlQbWdPWGxUbmlUVSIsInR5cCI6IkpPU0UiLCJodHRwOlwvXC9vcGVuYmFua2luZy5vcmcudWtcL2lzcyI6IkM9R0IsIE89T3BlbkJhbmtpbmcsIE9VPTAwMTU4MDAwMDFaRVozV0FBWCwgQ049NHRIQ0ZZemhtUlRwNWVkN1RyNUlONiIsImFsZyI6IlJTMjU2In0..KFmPmaOf3FwYLoOL2IjzhG00LMBCFOPQPOofOH21SIUKAmMmtuB8yccltLFT4lZ5m8EG0Yg9PFc1bbHQtZCwgoVGW9N8hzx5eNJ4sHJp6yIAo2QpXIyukKkRhnoxCvJVmi4hgkFW7pkVLDvOXTg8QORtf7ZEXD86ACCGE5KKq6d6jXnRYUmUusDBlDw0IhWyfvzfTL6Jhhe3Q9wYDlcGH5vvZgfJiRAOnDRw7rDDJ79hDJbP_CH1Jkj5yhGN1MthuSIdCXrM5BAqSZ5VRrNojgMI29FApIP_TMCzWzHKBysjIovtAJnPF3jBjQdChruEGK3PPl5DV3W6HucOtDfU4g`

# JSON Web Signature (JWS) and JWS Detached (Explanation)

## JSON Web Signature (JWS) represents content secured with digital signatures or Message Authentication Codes (MACs) using JSON-based data structures.

There are two defined serializations for JWSs: a compact (described in this article) and a JSON.

The compact serialised JWS is a string containing three parts (in order) joined with a dot (“.”):

- Header
- Payload
- Signature

Example of the compact serialised JWS string:
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIyMTgyMzkwMjIsIm5hbWUiOiJUb21hc3ogWndpZXJ6Y2hvxYQifQ.t3VhQ7QsILDuV_HNFSMI-Fb2FoT7fuzalpS5AH8A9c0`

Each part is BASE64URL encoded.
The Header describe the digital signature or message authentication code (MAC) applied to the the Payload and optionally additional properties of the JWS.

Header part before encoding is a JSON structure (example below):

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

The Header parameter names (object keys) within the Header must be unique. There are registered Header parameter names:

- “alg” (required) — algorithm, which identifies the cryptographic
  algorithm used to secure the JWS;  
  It can be set to ‘none’, which indicates that the Signature must be an empty string!

- “jku” — (optional) JWK Set URL is a URI that refers to a resource for a set of JSON-encoded public keys, one of which corresponds to the key used to digitally sign the JWS;

- “jwk” — (optional) JSON Web Key is the public key that corresponds to the private key used to digitally sign the JWS. This public key is represented as a JSON Web Key [JWK];

- “kid” — (optional) key ID is a hint indicating which key was used to secure the JWS. It can be used to inform recipient that key is changed;

- “x5u” — (optional) X.509 URL is a URI that points to a resource for the X.509 public key certificate or certificate chain corresponding to the private key used to digitally sign the JWS;

- “x5c” — (optional) X.509 certificate chain contains the X.509 public key certificate or certificate chain corresponding to the private key used to digitally sign the JWS;

- “x5t” — (optional) X.509 certificate SHA-1 thumbprint (fingerprint) is a
  base64url-encoded SHA-1 thumbprint (a.k.a. digest) of the DER
  encoding of the X.509 public certificate [RFC5280] corresponding to the private key used to digitally sign the JWS;

- “x5t#S256” — (optional) X.509 certificate SHA-256 thumbprint (fingerprint) is a base64url-encoded SHA-256 thumbprint (a.k.a. digest)
  of the DER encoding of the X.509 public certificate corresponding
  to the private key used to digitally sign the JWS;

- “typ” — (optional) type is used by JWS applications to declare the media type of the complete JWS;

- “cty” — (optional) content type is used by JWS applications
  to declare the media type of the Payload.

In our example header, we can see that JWS type is JSON Web Token (JWT) and that Payload is secured by HS256 (HMAC with SHA-256) cryptographic algorithm.

**The payload** can be any content. It can be JSON but it is not needed.

**The signature** is computed in the manner defined for the particular algorithm being used (and declared in the Header) from `ASCII(BASE64URL(UTF8(JWS Protected Header)) || ‘.’ ||BASE64URL(JWS Payload))`.

Important note: Do not confuse BASE64URL with BASE64!  
In BASE64URL:

- all trailing ‘=’ are removed
- ‘+’ is replaced by ‘-’
- ‘/’ is replaced by ‘\_’.

## JWS Detached is a variation of JWS that allows you to sign content (body) of HTTP request or response without its modification.

The HTTP header “x-jws signature” is added, which contains data allowing to check whether the message has not been changed on way from the sender to the recipient.

JWS Detached generation algorithm is very simple:

1. Generate a standard JWS using compact serialization using HTTP body as a payload,
2. Turn the middle part (Payload) into an empty string,
3. Put final string in the HTTP header “x-jws signature”

Example of the JWS Detached string: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..t3VhQ7QsILDuV_HNFSMI-Fb2FoT7fuzalpS5AH8A9c0`

Validation HTTP message with JWS Detached is simple too:

1. Get the HTTP header “x-jws signature”,
2. Get BASE64URL HTTP body
3. Put generate string 1) into the Payload section
4. Validate JWS
