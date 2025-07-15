const fs = require(‘fs’);
const path = require(‘path’);
const https = require(‘https’);

class LumAppsUserFetcher {
constructor(config) {
this.clientId = config.clientId;
this.clientSecret = config.clientSecret;
this.baseUrl = config.baseUrl || ‘https://api.lumapps.com’;
this.outputDir = config.outputDir || ‘./lumapps_users’;
this.accessToken = null;
}

// Bearer トークンを取得
async getAccessToken() {
return new Promise((resolve, reject) => {
const postData = JSON.stringify({
grant_type: ‘client_credentials’,
client_id: this.clientId,
client_secret: this.clientSecret
});

```
  const options = {
    hostname: 'api.lumapps.com',
    port: 443,
    path: '/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.access_token) {
          this.accessToken = response.access_token;
          console.log('✓ Bearer token obtained successfully');
          resolve(response.access_token);
        } else {
          reject(new Error('Failed to get access token: ' + data));
        }
      } catch (error) {
        reject(error);
      }
    });
  });

  req.on('error', (error) => {
    reject(error);
  });

  req.write(postData);
  req.end();
});
```

}

// APIリクエストを実行
async makeApiRequest(endpoint, params = {}) {
return new Promise((resolve, reject) => {
const queryString = new URLSearchParams(params).toString();
const fullPath = `/v1${endpoint}${queryString ? '?' + queryString : ''}`;

```
  const options = {
    hostname: 'api.lumapps.com',
    port: 443,
    path: fullPath,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    });
  });

  req.on('error', (error) => {
    reject(error);
  });

  req.end();
});
```

}

// ユーザーリストを取得（カーソルページネーション対応）
async fetchAllUsers() {
let allUsers = [];
let cursor = null;
let pageCount = 0;
const pageSize = 100; // 一度に取得するユーザー数

```
console.log('Starting user data fetch...');

do {
  pageCount++;
  console.log(`Fetching page ${pageCount}...`);

  try {
    const params = {
      limit: pageSize,
      status: 'active' // Activeなユーザーのみ
    };

    if (cursor) {
      params.cursor = cursor;
    }

    const response = await this.makeApiRequest('/users', params);
    
    if (response.users) {
      allUsers = allUsers.concat(response.users);
      console.log(`✓ Page ${pageCount}: ${response.users.length} users fetched (Total: ${allUsers.length})`);
    }

    // 次のページのカーソルを取得
    cursor = response.nextCursor || response.next_cursor;
    
    // APIレート制限対策のため少し待機
    await this.sleep(200);

  } catch (error) {
    console.error(`Error fetching page ${pageCount}:`, error.message);
    throw error;
  }
} while (cursor);

console.log(`\n✓ Total users fetched: ${allUsers.length}`);
return allUsers;
```

}

// 出力ディレクトリを作成
ensureOutputDirectory() {
if (!fs.existsSync(this.outputDir)) {
fs.mkdirSync(this.outputDir, { recursive: true });
console.log(`✓ Created output directory: ${this.outputDir}`);
}
}

// ユーザーデータをファイルに保存
async saveUsersToFile(users) {
this.ensureOutputDirectory();

```
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `lumapps_users_${timestamp}.json`;
const filepath = path.join(this.outputDir, filename);

try {
  // JSONファイルとして保存
  fs.writeFileSync(filepath, JSON.stringify(users, null, 2), 'utf8');
  console.log(`✓ Users data saved to: ${filepath}`);

  // CSVファイルとしても保存
  const csvFilename = `lumapps_users_${timestamp}.csv`;
  const csvFilepath = path.join(this.outputDir, csvFilename);
  await this.saveUsersToCSV(users, csvFilepath);

  return { jsonFile: filepath, csvFile: csvFilepath };
} catch (error) {
  console.error('Error saving users to file:', error.message);
  throw error;
}
```

}

// CSVファイルとして保存
async saveUsersToCSV(users, filepath) {
if (users.length === 0) return;

```
// CSVヘッダーを作成
const headers = Object.keys(users[0]).join(',');

// CSVデータを作成
const csvData = users.map(user => {
  return Object.values(user).map(value => {
    // 値にカンマや改行が含まれている場合はダブルクォートで囲む
    if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(',');
}).join('\n');

const csvContent = `${headers}\n${csvData}`;

try {
  fs.writeFileSync(filepath, csvContent, 'utf8');
  console.log(`✓ Users data saved to CSV: ${filepath}`);
} catch (error) {
  console.error('Error saving CSV file:', error.message);
  throw error;
}
```

}

// 統計情報を表示
displayStatistics(users) {
console.log(’\n=== User Statistics ===’);
console.log(`Total Active Users: ${users.length}`);

```
// 部署別統計（もし部署データがある場合）
const departments = {};
users.forEach(user => {
  const dept = user.department || 'Unknown';
  departments[dept] = (departments[dept] || 0) + 1;
});

console.log('\nDepartment Distribution:');
Object.entries(departments).forEach(([dept, count]) => {
  console.log(`  ${dept}: ${count} users`);
});
```

}

// 待機関数
sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}

// メイン実行関数
async run() {
try {
console.log(‘🚀 LumApps User Data Fetcher Starting…\n’);

```
  // 1. Bearer トークンを取得
  console.log('Step 1: Getting access token...');
  await this.getAccessToken();

  // 2. 全てのアクティブユーザーを取得
  console.log('\nStep 2: Fetching all active users...');
  const users = await this.fetchAllUsers();

  // 3. ユーザーデータをファイルに保存
  console.log('\nStep 3: Saving users to file...');
  const savedFiles = await this.saveUsersToFile(users);

  // 4. 統計情報を表示
  this.displayStatistics(users);

  console.log('\n✅ Process completed successfully!');
  console.log(`Files saved: ${savedFiles.jsonFile}, ${savedFiles.csvFile}`);

} catch (error) {
  console.error('❌ Error occurred:', error.message);
  process.exit(1);
}
```

}
}

// 使用例
async function main() {
const config = {
clientId: process.env.LUMAPPS_CLIENT_ID || ‘your-client-id’,
clientSecret: process.env.LUMAPPS_CLIENT_SECRET || ‘your-client-secret’,
baseUrl: ‘https://api.lumapps.com’,
outputDir: ‘./lumapps_users’
};

const fetcher = new LumAppsUserFetcher(config);
await fetcher.run();
}

// 環境変数の確認
function checkEnvironment() {
const requiredEnvVars = [‘LUMAPPS_CLIENT_ID’, ‘LUMAPPS_CLIENT_SECRET’];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
console.error(‘❌ Missing required environment variables:’);
missingVars.forEach(varName => {
console.error(`  - ${varName}`);
});
console.error(’\nPlease set these environment variables before running the script.’);
process.exit(1);
}
}

// スクリプトが直接実行された場合
if (require.main === module) {
checkEnvironment();
main().catch(console.error);
}

module.exports = LumAppsUserFetcher;
