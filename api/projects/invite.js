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
        const { projectId, email, permissions } = req.body;
        const userId = req.body.userId; // We'll get this from the frontend

        if (!projectId || !email || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log('Creating invitation:', { projectId, email, userId, permissions });

        // Generate invitation token
        const invitationToken = require('crypto').randomBytes(32).toString('hex');
        
        // For now, we'll store invitations in a simple way
        // In a real app, you'd have a proper invitations table
        const invitationData = {
            project_id: projectId,
            inviter_id: userId,
            invitee_email: email,
            token: invitationToken,
            permissions: permissions || 'view,edit',
            created_at: new Date().toISOString(),
            status: 'pending'
        };

        // Store invitation in user_data table as a simple solution
        // Get current user data
        const { data: userData, error: fetchError } = await supabase
            .from('user_data')
            .select('data')
            .eq('user_id', userId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching user data:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch user data' });
        }

        const currentData = userData?.data || { folders: [], uncategorized: [] };
        
        // Add invitation to user data
        if (!currentData.invitations) {
            currentData.invitations = [];
        }
        currentData.invitations.push(invitationData);

        // Save updated user data
        const { error: saveError } = await supabase
            .from('user_data')
            .upsert({
                user_id: userId,
                data: currentData
            }, {
                onConflict: 'user_id'
            });

        if (saveError) {
            console.error('Error saving invitation:', saveError);
            return res.status(500).json({ error: 'Failed to save invitation' });
        }

        // Create notification for the invitee if they exist
        const { data: inviteeUser, error: inviteeError } = await supabase
            .from('user_data')
            .select('user_id, data')
            .eq('user_id', email) // This is a simplified lookup - in real app you'd have a users table
            .single();

        if (!inviteeError && inviteeUser) {
            // Add notification to invitee's data
            const inviteeData = inviteeUser.data || { folders: [], uncategorized: [] };
            if (!inviteeData.notifications) {
                inviteeData.notifications = [];
            }
            
            inviteeData.notifications.push({
                id: Date.now().toString(),
                type: 'project_invitation',
                title: 'Project Invitation',
                message: `You've been invited to collaborate on a project`,
                data: { projectId, inviterId: userId, invitationToken },
                created_at: new Date().toISOString(),
                read: false
            });

            // Save invitee's updated data
            await supabase
                .from('user_data')
                .upsert({
                    user_id: inviteeUser.user_id,
                    data: inviteeData
                }, {
                    onConflict: 'user_id'
                });
        }

        console.log('Invitation created successfully');

        res.json({
            message: 'Invitation sent successfully',
            invitationToken,
            invitationLink: `${process.env.FRONTEND_URL || 'https://z-task.vercel.app'}?invite=${invitationToken}`
        });

    } catch (error) {
        console.error('Error creating invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
