const axios = require("axios").default;

async function login(username, password) {
  username = "danyfu@bu.edu";
  password = "foobar";

  return axios
    .post("https://us.elabjournal.com/api/v1/auth/user", {
      username: username,
      password: password,
    })
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      console.log(res.data);
      axios.defaults.headers.common['Authorization'] = res.data.token;
    })
    .catch((error) => {
      console.error(error);
    });
}

async function getSampleTypes(){
  await login();

  axios.get("https://us.elabjournal.com/api/v1/sampleTypes")
    .then(function (res) {
      // handle success
      console.log(res.data);
    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })
    .finally(function () {
      // always executed
    });
}

module.exports.sample = async function makeSample(){
  await login();

  axios
  .post("https://us.elabjournal.com/api/v1/samples?autoCreateMetaDefaults=true", {
      sampleTypeID: 33369,
      name: 'dany-test-api-sample'
    })
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      console.log(res.data);
      axios.defaults.headers.common['Authorization'] = res.data.token;
    })
    .catch((error) => {
      console.error(error);
    });

};




