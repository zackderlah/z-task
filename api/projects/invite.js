const cors = require('micro-cors')();
const crypto = require('crypto');

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
        console.log('Invitation request body:', req.body);
        
        const { projectId, email, permissions } = req.body;
        const userId = req.body.userId;

        if (!projectId || !email || !userId) {
            console.error('Missing required fields:', { projectId, email, userId });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log('Creating invitation:', { projectId, email, userId, permissions });

        // Generate invitation token
        const invitationToken = crypto.randomBytes(32).toString('hex');
        
        console.log('Invitation token generated:', invitationToken);

        // For now, just return the invitation link without storing in database
        // This ensures the function works and we can test the basic flow
        const invitationLink = `${process.env.FRONTEND_URL || 'https://z-task.vercel.app'}?invite=${invitationToken}`;
        
        console.log('Invitation created successfully');

        res.json({
            message: 'Invitation sent successfully',
            invitationToken,
            invitationLink,
            note: 'Invitation link generated. Database storage will be implemented in next version.'
        });

    } catch (error) {
        console.error('Error creating invitation:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
