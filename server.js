const axios = require("axios").default;
const ENDPOINTS = {
  LOGIN: "https://us.elabjournal.com/api/v1/auth/user",
  GET_SAMPLE_TYPES: "https://us.elabjournal.com/api/v1/sampleTypes",
  CREATE_SAMPLE: "https://us.elabjournal.com/api/v1/samples?autoCreateMetaDefaults=true",
  GET_ALL_PATIENT_SAMPLES: "https://us.elabjournal.com/api/v1/samples?sampleTypeID=33369"
};

async function login(username, password) {
  username = "danyfu@bu.edu";
  password = "foobar";

  return axios
    .post(ENDPOINTS.LOGIN, {
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

  axios.get(ENDPOINTS.GET_SAMPLE_TYPES)
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

async function makeSample(){
  await login();

  axios
    .post(ENDPOINTS.CREATE_SAMPLE, {
      sampleTypeID: 33369,
      name: 'dany-test-api-sample'
    })
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      console.log(res.data);
    })
    .catch((error) => {
      console.error(error);
    });

}

module.exports.sample = async function getAllPatientSamples(){
  await login();

  axios.get(ENDPOINTS.GET_ALL_PATIENT_SAMPLES)
    .then((res) => {
      console.log(`statusCode: ${res.status}`);
      console.log(res.data);
    })
    .catch((error) => {
      console.error(error);
    });

}






