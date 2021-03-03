const { Client } = require('pg')

class PostgresRepositoryBase {
  constructor() {
    if (process.env.DATABASE_URL.indexOf('localhost') >= 0) {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
    } else {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
    }

    this.client.connect();
  }

  endConnection() {
    console.log("postgres end connection...")
    this.client.end();
  }

  sqlQueryPromise(statement) {
    // this.client.connect();
    return new Promise((resolve, reject) => {
      this.client.query(statement, (err, res) => {
        if (err) {
          // this.client.end();
          console.log(err)
          reject(err);
        } else {
          // this.client.end();
          resolve(res.rows);
        }
      })
    });
  }
}

module.exports.PostgresRepositoryBase = PostgresRepositoryBase;