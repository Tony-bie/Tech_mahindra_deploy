import { useState, useEffect } from "react"
import api from "../../config/api"
import './suggestions.css'
import ReactMarkdown from 'react-markdown'
import ws from '../../config/ws';


export default function Suggestions() {
    // eslint-disable-next-line
    const [projects, setProjects] = useState([])
    const [projectsStatus, setProjectsStatus] = useState({red: [], yellow:[], all_data:[]})
    const [chat, setChat] = useState({})
    const [projectID, setProjectsID] = useState([])
    const [loading, setLoading] = useState(false)
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [selectedProject, setSelectedProject] = useState(null)
    const [aiOnlineSelect, setaiOnlineSelect] = useState(true)
    const [agentSelect, setAgentSelect] = useState([])

    function buildFilterStatus(data){
        return{
            all_data: data.filter(r => r.status !== 'green'),
            red: data.filter(r => r.status === 'red'),
            yellow: data.filter(y => y.status === 'yellow')
        }
    }

    async function generate_suggestion(project){

        setLoading(true)

        if(chat[project.id_project]){
            setProjectsID(project.id_project)
            setSelectedProject(project.project.project_name)
            setLoading(false)
            return
        }

        setProjectsID(project.id_project)

        setAgentSelect(prev => ({
            ...prev,
            [project.id_project]: aiOnlineSelect ? 'Gemini' : 'Ollama local'
        }))

        try{
            const response = await api.post('/suggestions/get_info_all_project',{ id_project: project.id_project })
            console.log('1. respuesta backend:', response.data.data)
            const mensaje = `  Responde siempre usando formato Markdown válido.
                                Usa **negritas** para títulos de sección.
                                Usa listas con "- " o "1. " para enumerar puntos.
                                Nunca uses saltos de línea simples como separadores de lista.
                                Eres una IA asistente de Project Manager. El proyecto tiene estatus "${project.status}".
                                Con base en estos datos: ${JSON.stringify(response.data.data)},
                                identifica la causa principal del problema y da UNA sugerencia concreta y breve de por dónde empezar a actuar. `

            if (aiOnlineSelect){
                console.log("Gemmini funcionando")
                try{
                    await api.post('/suggestions/chatbot',{mensaje: mensaje, id_project: project.id_project})
                } catch(error){
                    console.error(error)
                }
            }
            else{
                console.log("Local funcionando")
                try{
                    const model = 'llama3.2:3b';
                    const message = [{ role: "user",
                                        content: mensaje}];

                    const responseClaude = await fetch('http://localhost:11434/api/chat', {
                        method: 'POST',
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ model, messages: message, stream: true })
                    });

                    console.log(responseClaude)

                    const reader = responseClaude.body.getReader();
                    const decoder = new TextDecoder();

                    setSelectedProject(response.data.data[0].project_name)

                    setLoading(false)

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

                } catch(error){
                    console.error(error)
                }
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
        const handler = ({data}) => {
            const message = JSON.parse(data)
            if (message.type === 'chatbot'){
                setLoading(false)
                const chunk = message.data
                setChat(prev => ({
                    ...prev,
                    [message.id_project]: (prev[message.id_project] || "") + chunk
                }))

            }
        }

        getProjects()
        ws.addEventListener('message', handler)

        return () => {
            ws.removeEventListener('message', handler)
        }
    }, [])

    return(
        <div className="suggestions-container">

            {/* Header */}
            <div className="sg-header">
                <h1>Sugerencias de proyecto</h1>
                <p>Análisis con IA de proyectos en riesgo. Selecciona un proyecto para ver recomendaciones.</p>
            </div>

            {/* AI selector */}
            <div className="ai-selector">
                <span className="ai-selector-label">Motor IA</span>
                <button
                    className={`ai-btn ${aiOnlineSelect ? 'active' : ''}`}
                    onClick={() => setaiOnlineSelect(true)}
                >
                    ✦ Gemini
                </button>
                <button
                    className={`ai-btn ${!aiOnlineSelect ? 'active' : ''}`}
                    onClick={() => setaiOnlineSelect(false)}
                >
                    ⬡ IA Local
                </button>
            </div>

            {/* Layout */}
            <div className="suggestions-layout">
                {loadingProjects
                    ? <p className="loading-text-projects">Cargando proyectos...</p>
                    :
                    <>
                        {/* Panel izquierdo: tabla de proyectos */}
                        <div className="table-wrapper">
                            <div className="sg-panel-header">
                                <span className="sg-panel-label">Proyectos en riesgo</span>
                                <span className="sg-count-badge">{projectsStatus.all_data.length}</span>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Proyecto</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectsStatus.all_data.map(project => (
                                        <tr
                                            key={project.id_project}
                                            onClick={() => generate_suggestion(project)}
                                            className={projectID === project.id_project ? 'project-row--selected' : ''}
                                        >
                                            <td>{project.project.project_name}</td>
                                            <td>
                                                <span className={`badge badge-${project.status}`}>
                                                    {project.status === 'red' ? 'Rojo' : 'Amarillo'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Panel derecho: análisis AI */}
                        <div className="chat-panel">
                            <div className="chat-panel-header">
                                <div className={`chat-panel-dot ${loading ? 'chat-panel-dot--loading' : selectedProject ? '' : 'chat-panel-dot--idle'}`} />
                                <span className="chat-panel-title">
                                    {loading
                                        ? `Analizando ${selectedProject || 'proyecto'}...`
                                        : selectedProject
                                            ? `Análisis — ${selectedProject}`
                                            : 'Análisis de proyecto'
                                    }
                                </span>
                                {agentSelect[projectID] && (
                                    <span className="chat-panel-agent">{agentSelect[projectID]}</span>
                                )}
                            </div>

                            <div className="chat-panel-body">
                                {loading && (
                                    <p className="loading-text">Generando sugerencias</p>
                                )}

                                {chat[projectID] ? (
                                    <div className="chat-content">
                                        <h3 className="chat-title-project">{selectedProject}</h3>
                                        <ReactMarkdown>{chat[projectID]}</ReactMarkdown>
                                        <span className="powered-label">
                                            Potenciado por {agentSelect[projectID]}
                                        </span>
                                    </div>
                                ) : !loading && (
                                    <div className="chat-placeholder">
                                        <div className="chat-placeholder-icon">◈</div>
                                        <p>Selecciona un proyecto para ver sugerencias</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                }
            </div>
        </div>
    )
}
