const supabase = require('../../config/supabase');

async function consult_sprints(req, res) {
    const { project_id } = req.params;
    try {
        const response = await supabase
            .from('sprint')
            .select()
            .eq('id_project', project_id)

        console.log(response)
        
        if (response.error){
            return res.status(401).json({ message: 'Sprints not found' });
        }
        
        return res.status(200).json({ message: 'Consult sprints success', data: response.data });
        }
        catch(error){
            return res.status(500).json({ message: error.message });
    }
}

async function create_sprint(req, res) {
    const { project_id } = req.params

    const {nombre, fecha_inicio, estado, fecha_final, SP} = req.body

    const begin = fecha_inicio ? new Date(fecha_inicio).toISOString() : null
    const end = fecha_final  ? new Date(fecha_final).toISOString()  : null
    
    try{
        const response = await supabase
            .from('sprint')
            .insert({name: nombre, begin_at: begin, deadline: end, status: estado, SP_estimated: SP, id_project: project_id})
            .select()

        console.log(response)

        if (response.error){
            return res.status(401).json({ message: 'Sprints not found' });
        }

        return res.status(200).json({ message: 'Consult sprints success', data: response.data })
        
    } catch(error){
        return res.status(500).json({ message: error.message })
    }
}

module.exports = { consult_sprints, create_sprint};
