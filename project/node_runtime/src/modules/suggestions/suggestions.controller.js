const supabase = require('../../config/supabase')

async function get_projects(req, res) {
    const { id_user } = req.user

    console.log('id_user:', id_user)

    try{
        const responseMember = await supabase
            .from('project')
            .select('id_pm, id_project')
            .eq('id_pm', id_user)

        //console.log(responseMember)

        if (responseMember.error){
            return res.status(401).json({ message: 'Project not found' });
        }
        
        const ids = responseMember.data.map(r => r.id_project)

        const responseProject = await supabase
            .from('semaphore')
            .select('id_project, status, project(*)')
            .in('id_project', ids,)
            .in('status', ['yellow', 'red']) 
        
        //console.log(responseProject)

        if (responseProject.error){
            return res.status(401).json({ message: 'Not match semaphore' });
        }

        return res.status(200).json({ message: 'Consult projects semaphore success', data: responseProject.data })
    } catch(error){
        return res.status(501).json({ message: 'Consult projects semaphore failed' })
    }
}

async function chat_bot(req, res) {
    const { id_project } = req.body

    console.log(id_project)

    try{
        const responseProject = await supabase
            .from('all_data_project')
            .select('*')
            .eq('id_project', id_project)

        console.log(responseProject)
        
        if(responseProject.error){
            return res.status(401).json({ message: 'Not match project' });
        }

        return res.status(200).json({ message: 'Claude conversation success', data: responseProject.data })
    } catch(error){
        return res.status(501).json({ message: 'Consult projects semaphore failed' })
    }
    
}

module.exports = { get_projects, chat_bot }