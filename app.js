const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Use cheerio to parse HTML and selectively replace text content, not URLs
    const $ = cheerio.load(html);

    let about_yale_university = false;
    if ($('body').text().toLocaleLowerCase().includes('college') || $('body').text().toLocaleLowerCase().includes('university') || $('body').text().toLocaleLowerCase().includes('school')) {
      about_yale_university = true;
    }
    
    // Function to replace text but skip URLs and attributes
    function replaceYaleWithFale(i, el) {
      if ($(el).children().length === 0 || $(el).text().trim() !== '') {
        // Get the HTML content of the element
        let content = $(el).html();
        
        // Only process if it's a text node
        if (content && $(el).children().length === 0) {
          // Replace Yale with Fale in text content only
          if (about_yale_university) {
            content = content.replace(/\b(Yale)\b/gi, (match) => {
              if (match === 'Yale') return 'Fale';
              if (match === 'YALE') return 'FALE';
              return 'fale';
            });
          }
          $(el).html(content);
        }
      }
    }
    
    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      // Replace text content but not in URLs or attributes
      const text = $(this).text();
      if (about_yale_university) {
        const newText = text.replace(/\b(Yale)\b/gi, (match) => {
          if (match === 'Yale') return 'Fale';
          if (match === 'YALE') return 'FALE';
          return 'fale';
        });
        if (text !== newText) {
          $(this).replaceWith(newText);
        }
      }
    });
    
    // Process title separately
    if (about_yale_university) {
      title = $('title').text().replace(/\b(Yale)\b/gi, (match) => {
        if (match === 'Yale') return 'Fale';
        if (match === 'YALE') return 'FALE';
        return 'fale';
      });
    }
    $('title').text(title);
    
    return res.json({ 
      success: true, 
      content: $.html(),
      title: title,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Faleproxy server running at http://localhost:${PORT}`);
});