module.exports = {
  // `check:eslint` (eslint src/*) は src 直下のファイルを拡張子問わず明示指定で渡すため、
  // プレーン CSS の src/index.css が TS パーサーに食わされて parse error になる。
  // ここで素の .css だけ除外する (vanilla-extract の .css.ts は末尾が .css でないため対象外)。
  ignorePatterns: ['**/*.css'],
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    'airbnb',
    'prettier',
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  "globals": {
    JSX: "readonly"
  },
  plugins: [
    'react',
    '@typescript-eslint'
  ],
  rules: {
    'linebreak-style': 0,
    'no-underscore-dangle': 0,
    "no-shadow": "off",

    "import/prefer-default-export": "off",
    "import/extensions": "off",
    "import/no-unresolved": "off",
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: true,
      },
    ],

    'react/no-unstable-nested-components': [
      'error',
      { allowAsProps: true },
    ],
    "react/jsx-filename-extension": [
      "error",
      {
        extensions: [".tsx", ".jsx"],
      },
    ],

    "react/require-default-props": "off",
    "react/jsx-props-no-spreading": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",

    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-shadow": "error"
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'no-undef': 'off',
      },
    },
  ],
};
