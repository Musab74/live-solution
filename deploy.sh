

#production
git reset --hard 
git checkout master
git pull origin master

npm install --legacy-peer-deps
npm run build

# 4) Restart PM2 from the SAME folder so the app sees .env in its CWD
pm2 delete live-backend
pm2 start dist/main.js --name live-backend
pm2 save
