const crypto = require('crypto');

module.exports = async (req, res) => {
    // Enable CORS manually
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
        console.log('=== INVITATION API CALLED ===');
        console.log('Request method:', req.method);
        console.log('Request headers:', req.headers);
        
        // Parse request body
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                console.log('Raw request body:', body);
                
                const requestData = JSON.parse(body);
                console.log('Parsed request body:', requestData);
                
                const { projectId, email, permissions, userId } = requestData;

                if (!projectId || !email || !userId) {
                    console.error('Missing required fields:', { projectId, email, userId });
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                console.log('Creating invitation:', { projectId, email, userId, permissions });

                // Generate invitation token
                const invitationToken = crypto.randomBytes(32).toString('hex');
                
                console.log('Invitation token generated:', invitationToken);

                // Create invitation link
                const invitationLink = `https://z-task.vercel.app?invite=${invitationToken}`;
                
                console.log('Invitation created successfully');

                res.json({
                    message: 'Invitation sent successfully',
                    invitationToken,
                    invitationLink,
                    note: 'Invitation link generated successfully'
                });

            } catch (parseError) {
                console.error('Error parsing request body:', parseError);
                res.status(400).json({ error: 'Invalid request body' });
            }
        });

    } catch (error) {
        console.error('Error in invitation API:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
};