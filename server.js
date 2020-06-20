const http = require('follow-redirects').http;

module.exports.login = function login(username, password){
  username = 'danyfu@bu.edu';
  password = 'foobar';
  //let auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
  const data = JSON.stringify({
    'username': username,
    'password': password
  });

  let options = {
    host: 'elabinventory.com',
    path: '/api/v1/auth/user',
    method: 'POST',
    // Authorization: auth
    // auth: `${username}:${password}`
    headers: {'Content-Type': 'application/json',
              'Accept': 'application/json',
              // 'Content-Length': data.length
              // 'Authorization': {
              //   'username': username,
              //   'password': password
              //   }
              }
  };

  let callback = function(response) {
    let str = '';
    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      console.log('STATUS: ' + response.statusCode);
      console.log(str);
    });
  };

  let req = http.request(options, callback);
  req.write(data);
  // console.log(req);
  req.end();
};





// Using the request library which is deprecated
const request = require('request');

module.exports.login2 = function login2(username, password){
  username = 'danyfu@bu.edu';
  password = 'foobar';

  request.post('https://www.elabinventory.com/api/v1/auth/user', {
    json: {
      'username': username,
      'password': password
    }
  }, (error, res, body) => {
    if (error) {
      console.error(error);
      return
    }
    console.log(`statusCode: ${res.statusCode}`);
    console.log(body)
  });

};