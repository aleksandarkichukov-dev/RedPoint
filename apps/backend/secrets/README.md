# Secrets

Key material lives here as files, not as values in `.env`.

A PEM key is multi-line, and squeezing one into an environment variable means
escaping every newline as `\n` inside quotes. One missing character and the
signature fails with an error that says nothing useful about why. Files avoid
the whole class of problem, and they are what a server wants anyway.

**Everything in this directory except this README is gitignored.** Nothing here
ever reaches the repository.

## What goes here

| File | What it is | Where it comes from |
|---|---|---|
| `mypos-private-key.pem` | our RSA private key, signs requests to myPOS | shown once when generating the key pair in the myPOS portal |
| `mypos-certificate.pem` | myPOS's public certificate, verifies their IPN callbacks | downloaded from the same screen |

Save them with exactly these names. Paste the whole block including the
`-----BEGIN ...-----` and `-----END ...-----` lines, and leave no blank line
before or after — myPOS's own documentation calls that out, because stray
whitespace around the dashes breaks the parse.

## What stays in `.env`

The values that are not secret-shaped:

```
MYPOS_SID=90194
MYPOS_WALLET=
MYPOS_KEY_INDEX=
MYPOS_SANDBOX=true
```

`MYPOS_SANDBOX=true` points the integration at myPOS's test checkout, which has
its own published credentials and charges nobody. It must become `false` — with
the real values above — before the shop takes a live payment.
