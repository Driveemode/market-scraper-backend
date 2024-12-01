// For this example you need the node-fetch npm packages: `npm i node-fetch`
import fetch from 'node-fetch';

fetch('https://api.scraperapi.com/?api_key=8dcef76ad04710bd64b4362e9ded6185&url=https%3A%2F%2Fwww.walmart.com%2Fsearch%2F%3Fquery%3Dlaptop')
  .then(response => {
    console.log(response)
  })
  .catch(error => {
    console.log(error)
  });
