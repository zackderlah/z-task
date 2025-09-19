const { createClient } = require('@supabase/supabase-js');
const cors = require('micro-cors')();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = cors(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Accept invitation request body:', req.body);
        
        const { invitationToken, userId } = req.body;

        if (!invitationToken || !userId) {
            console.error('Missing required fields:', { invitationToken, userId });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log('Processing invitation acceptance:', { invitationToken, userId });

        // For now, we'll simulate accepting the invitation
        // In a real app, you'd look up the invitation in the database
        // and add the user to the project with the specified permissions
        
        // Simulate success
        const result = {
            success: true,
            message: 'Invitation accepted successfully',
            projectId: 'simulated-project-id',
            permissions: 'view,edit'
        };

        console.log('Invitation accepted successfully');

        res.json(result);

    } catch (error) {
        console.error('Error accepting invitation:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
});
