'use strict';

const metarhia = require('eslint-config-metarhia');

module.exports = [
  ...metarhia,
  {
    rules: {
      'linebreak-style': 'off',
      'max-len': 'off',
      strict: 'off',
      'new-cap': 'off',
    },
  },
];
