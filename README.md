# IJANT Gallery (Node / Vercel)

Static pages in `public/`, serverless API in `api/`, DB helper in `lib/db.js`.

## Env vars (Vercel -> Settings -> Environment Variables)
NEON_DB_URL, IJUS_TOKEN, IJUS_BASE_URL (default https://pink.ijadium.com/bucket), IJUS_BUCKET_NAME (default ijantdata)
Use Neon's pooled connection string (host contains `-pooler`).

## Deploy
    npm i -g vercel
    vercel            # preview
    vercel --prod

## Local
    cp .env.example .env   # fill in values
    vercel dev
