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

    try {
        const userId = req.method === 'GET' ? req.query.userId : req.body.userId;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        if (req.method === 'GET') {
            // Get user notifications
            const { data: userData, error } = await supabase
                .from('user_data')
                .select('data')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching user data:', error);
                return res.status(500).json({ error: 'Failed to fetch notifications' });
            }

            const notifications = userData?.data?.notifications || [];
            console.log('Fetched notifications for user:', userId, 'Count:', notifications.length);
            
            res.json(notifications);

        } else if (req.method === 'POST') {
            // Mark notification as read
            const { notificationId } = req.body;

            if (!notificationId) {
                return res.status(400).json({ error: 'Notification ID required' });
            }

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
            
            // Update notification
            if (currentData.notifications) {
                const notification = currentData.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.read = true;
                    notification.read_at = new Date().toISOString();
                }
            }

            // Save updated data
            const { error: saveError } = await supabase
                .from('user_data')
                .upsert({
                    user_id: userId,
                    data: currentData
                }, {
                    onConflict: 'user_id'
                });

            if (saveError) {
                console.error('Error saving notification update:', saveError);
                return res.status(500).json({ error: 'Failed to update notification' });
            }

            res.json({ message: 'Notification marked as read' });

        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
