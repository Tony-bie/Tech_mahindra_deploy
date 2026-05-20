const supabase = require('../../config/supabase')

const ai = require('../../config/gemini')

const { WebSocket } = require('ws');

const server = require('../../../WsServer')

async function get_projects(req, res) {
    const { id_user } = req.user

    //console.log('id_user:', id_user)

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

async function get_info_all_project(req, res) {
    const { id_project } = req.body

    console.log(id_project)

    try{
        const responseProject = await supabase
            .from('all_data_project')
            .select('*')
            .eq('id_project', id_project)

        //console.log(responseProject)
        
        if(responseProject.error){
            return res.status(401).json({ message: 'Not match project' });
        }

        return res.status(200).json({ message: 'Claude conversation success', data: responseProject.data })
    } catch(error){
        return res.status(501).json({ message: 'Consult projects semaphore failed' })
    }
    
}

async function chat_bot(req, res) {
    const {mensaje, id_project} = req.body
    try {
        const stream = await ai.interactions.create({
            model: "gemini-3.5-flash",
            input: String(mensaje),
            stream: true,
        });

        for await (const event of stream) {
            console.log('EVENT:', event.event_type)
            if (event.event_type === "step.delta") {
                if (event.delta.type === "text") {
                    process.stdout.write(event.delta.text);
                    server.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) { 
                            client.send(JSON.stringify({type: 'chatbot', data: event.delta.text, id_project: id_project}))
                        }
                    });
                }
            }
        }
        res.json({ ok: true })
    } 
    catch (error) {
        console.error('chat_bot error:', error)
        res.status(500).json({ message: 'chatbot failed' })
  }
}


module.exports = { get_projects, get_info_all_project, chat_bot }