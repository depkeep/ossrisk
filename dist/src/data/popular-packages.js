// Curated lists of popular packages used as typosquat reference targets.
// These are the names attackers most commonly impersonate. Lists are deliberately
// kept compact — broader coverage would multiply false positives without
// catching meaningfully more real attacks.
export const POPULAR_NPM = [
    // Core utilities
    'lodash', 'underscore', 'ramda', 'moment', 'dayjs', 'date-fns', 'uuid',
    'nanoid', 'shortid', 'chalk', 'colors', 'color', 'kleur', 'picocolors', 'debug',
    'minimist', 'yargs', 'commander', 'meow', 'inquirer', 'prompts', 'ora',
    'figlet', 'cli-progress', 'dotenv', 'cross-env', 'rimraf', 'mkdirp',
    'glob', 'globby', 'fast-glob', 'chokidar', 'fs-extra', 'graceful-fs',
    // HTTP / network
    'axios', 'node-fetch', 'got', 'request', 'superagent', 'undici', 'ws',
    'socket.io', 'socket.io-client', 'cors', 'helmet', 'morgan', 'compression',
    // Frameworks / servers
    'express', 'koa', 'fastify', 'hapi', 'nest', '@nestjs/core', 'next',
    'nuxt', 'remix', 'gatsby', 'astro', 'svelte', 'vue', 'react', 'react-dom',
    'react-native', 'preact', 'solid-js', 'angular', '@angular/core',
    '@angular/common', 'ember-cli', 'meteor', 'react-dnd',
    // Build / tooling
    'webpack', 'rollup', 'parcel', 'vite', 'esbuild', 'turbo', 'tsup', 'swc', 'acorn',
    'babel-core', '@babel/core', '@babel/preset-env', '@babel/preset-react',
    'typescript', 'tsc', 'ts-node', 'tsx', 'tslib', 'postcss', 'autoprefixer',
    'tailwindcss', 'sass', 'less', 'stylus',
    // Testing
    'jest', 'mocha', 'chai', 'sinon', 'vitest', 'jasmine', 'ava', 'tap',
    'cypress', 'playwright', 'puppeteer', '@testing-library/react',
    '@testing-library/jest-dom', 'supertest', 'nock', 'msw',
    // Linting / format
    'eslint', 'prettier', 'standard', 'xo', 'stylelint', 'husky', 'lint-staged',
    // State / data
    'redux', '@reduxjs/toolkit', 'mobx', 'zustand', 'recoil', 'jotai', 'xstate',
    'react-redux', 'react-router', 'react-router-dom', 'react-query',
    '@tanstack/react-query', 'swr', 'apollo-client', '@apollo/client',
    'graphql', 'relay',
    // DB / ORM
    'mongoose', 'sequelize', 'prisma', 'typeorm', 'knex', 'pg', 'mysql',
    'mysql2', 'mongodb', 'redis', 'ioredis', 'mssql', 'sqlite3', 'better-sqlite3',
    // Auth / crypto
    'jsonwebtoken', 'jws', 'jwks-rsa', 'jose', 'passport', 'bcrypt', 'bcryptjs',
    'argon2', 'crypto-js', 'node-forge', 'openid-client',
    // Validation / parsing
    'zod', 'yup', 'joi', 'ajv', 'class-validator', 'class-transformer',
    'cheerio', 'jsdom', 'xml2js', 'fast-xml-parser', 'csv-parse', 'csv-parser',
    'papaparse', 'marked', 'markdown-it', 'remark', 'unified', 'prismjs',
    // Logging / monitoring
    'winston', 'pino', 'bunyan', 'log4js', 'loglevel', 'signale', '@sentry/node',
    '@sentry/browser',
    // Common targets of past attacks
    'event-stream', 'ua-parser-js', 'coa', 'rc', 'cross-fetch', 'flatmap-stream',
    'colors.js', 'faker', 'node-ipc', 'left-pad',
];
export const POPULAR_PYPI = [
    // Core / stdlib-adjacent
    'requests', 'urllib3', 'httpx', 'aiohttp', 'click', 'typer', 'argparse',
    'rich', 'tqdm', 'colorama', 'termcolor', 'pyyaml', 'toml', 'tomli',
    'tomllib', 'python-dotenv', 'pydantic', 'attrs', 'dataclasses-json',
    'marshmallow', 'cerberus',
    // Web frameworks
    'django', 'flask', 'fastapi', 'starlette', 'uvicorn', 'gunicorn', 'tornado',
    'bottle', 'pyramid', 'aiohttp', 'sanic', 'falcon', 'werkzeug', 'jinja2',
    'mako', 'flask-cors', 'flask-login', 'flask-sqlalchemy', 'djangorestframework',
    // Data / ML
    'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn', 'plotly', 'bokeh',
    'scikit-learn', 'tensorflow', 'keras', 'torch', 'pytorch-lightning',
    'transformers', 'huggingface-hub', 'datasets', 'accelerate', 'openai',
    'anthropic', 'langchain', 'llama-index', 'sentence-transformers', 'spacy',
    'nltk', 'gensim', 'xgboost', 'lightgbm', 'catboost', 'statsmodels',
    // DB / ORM
    'sqlalchemy', 'alembic', 'psycopg2', 'psycopg2-binary', 'psycopg', 'pymongo',
    'redis', 'pymysql', 'mysqlclient', 'asyncpg', 'aiomysql', 'motor',
    'elasticsearch', 'cassandra-driver',
    // Testing
    'pytest', 'pytest-cov', 'pytest-asyncio', 'pytest-mock', 'pytest-django',
    'unittest', 'mock', 'tox', 'nose', 'nose2', 'hypothesis', 'faker',
    'factory-boy', 'responses', 'vcrpy',
    // Auth / crypto
    'cryptography', 'pyjwt', 'authlib', 'oauthlib', 'requests-oauthlib',
    'passlib', 'bcrypt', 'paramiko', 'pyopenssl',
    // HTTP / async
    'asyncio', 'trio', 'anyio', 'celery', 'rq', 'kombu', 'pika', 'kafka-python',
    'confluent-kafka',
    // Cloud / infra
    'boto3', 'botocore', 'google-cloud-storage', 'google-cloud-bigquery',
    'azure-storage-blob', 'azure-identity', 'kubernetes', 'docker', 'paramiko',
    'fabric', 'ansible',
    // Parsing
    'beautifulsoup4', 'lxml', 'html5lib', 'pyquery', 'selectolax', 'feedparser',
    'markdown', 'mistune', 'pygments', 'jsonschema', 'orjson', 'ujson', 'simplejson',
    // CLI / dev tools
    'pip', 'setuptools', 'wheel', 'twine', 'poetry', 'pipenv', 'virtualenv',
    'black', 'ruff', 'isort', 'flake8', 'pylint', 'mypy', 'pyright', 'bandit',
    'pre-commit', 'ipython', 'jupyter', 'notebook', 'jupyterlab',
    // Misc heavy-targets
    'pillow', 'opencv-python', 'imageio', 'qrcode',
];
export const POPULAR_NPM_SET = new Set(POPULAR_NPM);
export const POPULAR_PYPI_SET = new Set(POPULAR_PYPI);
//# sourceMappingURL=popular-packages.js.map