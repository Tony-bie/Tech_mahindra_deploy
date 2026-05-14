import { useState, useEffect } from "react"
import api from "../../config/api"
import './suggestions.css'

export default function Suggestions() {
    // eslint-disable-next-line
    const [projects, setProjects] = useState([])
    const [projectsStatus, setProjectsStatus] = useState({red: [], yellow:[], all_data:[]})
    const [chat, setChat] = useState({})
    const [projectID, setProjectsID] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [selectedProject, setSelectedProject] = useState(null)

    function buildFilterStatus(data){
        return{
            all_data: data.filter(r => r.status !== 'green'),
            red: data.filter(r => r.status === 'red'),
            yellow: data.filter(y => y.status === 'yellow')
        }
    }

    async function handleClick(project){

        setLoading(true)

        if(chat[project.id_project]){
            setProjectsID(project.id_project)
            setSelectedProject(project.project.project_name)
            setLoading(false)
            return
        }
        setProjectsID(project.id_project)
        try{
            const response = await api.post('/suggestions/chat-bot',{ id_project: project.id_project })
            console.log('1. respuesta backend:', response.data.data)  

            const model = 'llama3.2:3b';
            const message = [{ role: "user", 
                                content: `Eres una IA asistente de Project Manager. El proyecto tiene estatus "${project.status}". 
                                            Con base en estos datos: ${JSON.stringify(response.data.data)}, 
                                            identifica la causa principal del problema y da UNA sugerencia concreta y breve de por dónde empezar a actuar. ` }];

            const responseClaude = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model, messages: message, stream: true })
            });

            console.log(responseClaude)

            const reader = responseClaude.body.getReader();
            const decoder = new TextDecoder();


            setSelectedProject(response.data.data[0].project_name)

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const str = decoder.decode(value, { stream: true });
                const data = JSON.parse(str);
                setChat(prev => ({
                    ...prev,
                    [project.id_project]: (prev[project.id_project] || "") + data.message.content
                }))
            }
            } catch (error) {
                console.error('Error fetching chat API:', error);
            }  finally {
                setLoading(false)
            }
    };

    useEffect(()=> {
        async function getProjects() {
            try{
                const response = await api.get('/suggestions/get-projects')
                if(response){
                    setProjects(response.data.data)
                    setProjectsStatus(buildFilterStatus(response.data.data))
                    setLoadingProjects(false)
                    console.log('respuesta completa:', response)
                    console.log('data:', response.data)
                } else{
                    return <h1>Error al cargar proyecto</h1>
                }
            } catch(error){
            console.error(error)
            }
        }  
        getProjects()
    }, [])
     
    return(
        <div className="suggestions-container">
            <h1>Sugerencias de proyecto</h1>
            <div className="suggestions-layout">
                {loadingProjects 
                    ? <p className="loading-text-projects">Cargando proyectos...</p>
                    : 
                    <>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                            <tr>
                                <th>Nombre del proyecto</th>
                                <th>Estado</th>
                                <th>Chat</th>
                            </tr>
                            </thead>
                            <tbody>
                            {projectsStatus.all_data.map(project => (
                                <tr key={project.id_project}>
                                <td>{project.project.project_name}</td>
                                <td>
                                    <span className={`badge badge-${project.status}`}>
                                    {project.status}
                                    </span>
                                </td>
                                <td>
                                    <button className="btn-chat" onClick={() => handleClick(project)}>
                                    Seleccionar
                                    </button>
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                        <div className="chat-panel">
                            {loading && <p className="loading-text">Analizando proyecto...</p>}
                            {selectedProject && <h3>Analizando el proyecto: {selectedProject}</h3>}
                            {chat[projectID]
                                ? <p className="chat-content">{chat[projectID]}</p>
                                : !loading && <p className="chat-placeholder">Selecciona un proyecto para ver sugerencias</p>
                            }
                        </div>
                    </>
                    }
            </div>
            </div>
    )
}