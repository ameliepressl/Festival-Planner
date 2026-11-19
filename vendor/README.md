# vendor/ — third-party code, pinned

The app has exactly one third-party library. It is copied here instead of being loaded
from the internet, so the version can never change by itself and the app does not depend
on a download service during the demo.

| File | What | Version | Source | Licence |
| --- | --- | --- | --- | --- |
| `supabase-js-2.119.2.js` | Supabase client: sign-in and reading/writing the `festivals` table | 2.119.2 (exact) | `npm pack @supabase/supabase-js@2.119.2` → `dist/umd/supabase.js`, unchanged | MIT, see `supabase-js-LICENSE` |

`index.html` loads it with an integrity hash. The browser refuses to run the file if a
single byte differs:

```
sha384-A97u3Qnt9GZHURO9YJZRe7VQgGUeFzcv6I1oIGnUTxQrCxnpQMwR0/G8F2zt9abZ
```

## Updating (only on purpose, in its own pull request)

1. `npm pack @supabase/supabase-js@<new version>` and copy `package/dist/umd/supabase.js`
   here as `supabase-js-<new version>.js`; delete the old file.
2. New hash: `echo "sha384-$(openssl dgst -sha384 -binary vendor/supabase-js-<version>.js | openssl base64 -A)"`.
3. Update the `<script>` tag in `index.html` and this table.
4. Check for known vulnerabilities: in an empty folder run
   `npm install @supabase/supabase-js@<version> && npm audit`.
