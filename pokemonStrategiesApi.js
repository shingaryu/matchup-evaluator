// import axios from 'axios';
const axios = require('axios');
const { get } = require('http');

const baseUrl = 'https://dev-matchup-chart-api.herokuapp.com';

async function getPokemonStrategies() {
  return axios.get(`${baseUrl}/pokemonStrategies`, {
    params: {
      speciesInfo: true
    }
  });
}

module.exports.getPokemonStrategies = getPokemonStrategies;