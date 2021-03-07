const { Client } = require('pg')

class PostgresRepositoryBase {
  constructor() {
    this.connected = false;

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
  }

  async initConnection() {
    console.log("establish postgres connection...")
    try {
      await this.client.connect();
      console.log("postgres connection established!")
      this.connected = true;
    } catch (e) {
      console.log("failed to create postgres connection")
      this.connected = false;     
      throw (e);
    }
  }

  async endConnection() {
    console.log("postgres end connection...")
    return this.client.end();
  }

  sqlQueryPromise(statement) {
    return new Promise((resolve, reject) => {
      // not concurrency safe?
      const initPromise = this.connected ? Promise.resolve(): this.initConnection();
      initPromise.then(() => {
        this.client.query(statement, (err, res) => {
          if (err) {
            console.log(err)
            reject(err);
          } else {
            resolve(res.rows);
          }
        })
      }, initError => {
        reject(initError)
      });
    });
  }
}

module.exports.PostgresRepositoryBase = PostgresRepositoryBase;