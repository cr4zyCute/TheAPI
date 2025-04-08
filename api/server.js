require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const serverless = require('serverless-http');

const app = express();

// CORS Configuration
const corsOptions = {
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"]
};

app.use(cors(corsOptions));
app.use(express.json());

// Custom Middleware to Handle CORS Preflight Requests
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    
    next();
});

// MODIFIED: Path to channels.json - now looking in node_modules
const CHANNELS_FILE = path.join(__dirname, 'channels.json');

// Helper function to read channels
async function readChannels() {
    try {
        const data = await fs.readFile(CHANNELS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading channels file:', err);
        // MODIFIED: Return empty array if file doesn't exist
        if (err.code === 'ENOENT') {
            await writeChannels([]); // Create empty file if it doesn't exist
            return [];
        }
        return [];
    }
}

// Helper function to write channels
async function writeChannels(channels) {
    try {
        // MODIFIED: Ensure directory exists before writing
        await fs.mkdir(path.dirname(CHANNELS_FILE), { recursive: true });
        await fs.writeFile(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing channels file:', err);
        return false;
    }
}

// Get all channels
app.get('/channels', async (req, res) => {
    try {
        const channels = await readChannels();
        res.json(channels);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load channels' });
    }
});

// Add a new channel
app.post('/channels', async (req, res) => {
    try {
        const { name, url, type, clearKey } = req.body;
        
        if (!name || !url || !url.startsWith("http")) {
            return res.status(400).json({ error: "Valid name and URL are required" });
        }

        const channels = await readChannels();
        const newChannel = { 
            name, 
            url, 
            type: type || "dash",
            clearKey: clearKey || {}
        };
        
        channels.push(newChannel);
        await writeChannels(channels);
        
        res.status(201).json(newChannel);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add channel' });
    }
});

// Delete a channel by name
app.delete('/channels/:name', async (req, res) => {
    try {
        const name = req.params.name;
        let channels = await readChannels();
        
        const initialLength = channels.length;
        channels = channels.filter(channel => channel.name !== name);
        
        if (channels.length === initialLength) {
            return res.status(404).json({ error: "Channel not found" });
        }
        
        await writeChannels(channels);
        res.json({ message: "Channel deleted" });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete channel' });
    }
});

// Root API message
app.get('/', (req, res) => {
    res.send("IPTV API Server is running!");
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Channels file location: ${CHANNELS_FILE}`);
});
module.exports = app;
module.exports.handler = serverless(app); // required for Vercel