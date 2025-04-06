const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');
const path = require('path');
const fs = require('fs');

// Set a different port for testing to avoid conflict with the main app
describe('Integration Tests', () => {
  let server;
  const TEST_PORT = 3099;

  // Modify the app to use a test port
  beforeAll(async () => {
    // Mock external HTTP requests but allow localhost
    nock.disableNetConnect();
    nock.enableNetConnect('localhost');
    
    // Create a temporary test app file with correct path
    const appContent = fs.readFileSync('app.js', 'utf8');
    const modifiedContent = appContent.replace(/const PORT = 3001/, `const PORT = ${TEST_PORT}`);
    fs.writeFileSync('app.test.js', modifiedContent);
    
    // Start the test server with proper process group
    server = require('child_process').spawn('node', ['app.test.js'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });
    server.unref();  // Unreference from the parent process

    // Store the process group ID
    const pgid = -server.pid;
    
    // Give the server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Add cleanup handler for the process
    process.on('exit', () => {
      try {
        process.kill(pgid, 'SIGTERM');
      } catch (err) {
        // Ignore errors during exit
      }
    });
  }, 10000); // Increase timeout for server startup

  afterAll(async () => {
    // Kill the test server and clean up
    try {
      if (server && server.pid) {
        process.kill(-server.pid, 'SIGTERM');
      }
    } catch (error) {
      // Ignore kill errors as the process might already be gone
    } finally {
      server = null;
    }
    
    try {
      fs.unlinkSync('app.test.js');
    } catch (error) {
      console.error('Error removing test file:', error);
    }
    
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    nock('https://www.yale.edu')
      .get('/')
      .reply(200, sampleHtmlWithYale);
    
    // Make a request to our proxy app
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'https://www.yale.edu/'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    
    // Verify Yale has been replaced with Fale in text
    const $ = cheerio.load(response.data.content);
    expect($('title').text()).toContain('Fale University');
    expect($('h1').text()).toContain('Fale University');
    expect($('body').text()).toContain('Fale University');
    
    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
        }
    });
    expect(hasYaleUrl).toBe(true);
  }, 10000); // Increase timeout for this test

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'invalid-url'
      });
      expect(true).toBe(false);
    } catch (error) {
      expect(error.isAxiosError).toBe(true);
      expect(error.response?.status || 500).toBe(500);
    }
  });

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      expect(true).toBe(false);
    } catch (error) {
      expect(error.isAxiosError).toBe(true);
      expect(error.response?.status || 400).toBe(400);
      expect(error.response?.data?.error).toBe('URL is required');
    }
  });
});