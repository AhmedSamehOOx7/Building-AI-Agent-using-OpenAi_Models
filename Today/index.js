import fs from "fs/promises"
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import 'dotenv/config'
import { ChromaClient } from "chromadb";

// ============== Step 1 : Read file content =====================

const filePath = './document.txt';
const txt =   await fs.readFile(filePath , "utf-8");


// ================ Step 2 : Split text into chunks ==============


const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 300, 
    chunkOverlap :50
})

const chunks =  await splitter.splitText(txt);


// ================= Step 3 : Create embeddings ========================


async function getEmbedding(text){

    const response =  await fetch('https://api.openai.com/v1/embeddings', {

        method : "POST",
        headers : {
            "Content-Type": "application/json",
            "Authorization":   `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body:JSON.stringify({
            model : "text-embedding-3-small",
            input : text
        })
    });
     const data = await response.json();
       return data.data[0].embedding;

}

const vectors = [];

for( let i= 0 ; i< chunks.length ; i++){

    const vector =  await getEmbedding(chunks[i]);

    vectors.push({
        id : `chunk-${i}`,
        embedding : vector,
        metadata : {text : chunks[i]}
    })

}


// ====================== Step 4 : Store emeddings in ChromaDB ============================

const client = new ChromaClient({ host:"localhost" , port: 8000 , ssl: false});

const collection  = await client.getOrCreateCollection({name : "OS_Rag_System",embeddingFunction: null})
collection.add( {
    ids : vectors.map( v => v.id),
    embeddings : vectors.map( v => v.embedding),
    metadatas: vectors.map(v => v.metadata)
})

// console.log("✅ Stored embeddings in chromDB");


// ===================== Step 5 : Query Embedding ==================
// const query = "what is js?";
// const queryEmeddings = await  getEmbedding(query);


// =================== Step 6 : Search chroma for similar chuncks =================
 


async function searchReleventChunks(query , topK = 3 ){

    const queryEmeddings = await  getEmbedding(query);

     const results =  await collection.query({

        queryEmbeddings : [ queryEmeddings ],
        nResults : topK,
        include : ["metadatas" , "distances"]

    })

    return  results.metadatas[0].map( m=> m.text);
    
}

 const releventChunks =  await searchReleventChunks("Who made this file?");


//  ==================== Step 7 : function to generate answer using openai llm ==================


async function getAnswerFromOpenAI( question , releventChunks){

    const contextText = releventChunks.join(" \n\n");

    const prompt = `use the following context to answer the question: \n\n ${contextText} \n\n Question:${question}`;


     const res  = await fetch('https://api.openai.com/v1/chat/completions', {
        method: "POST",
         headers : {
            "Content-Type": "application/json",
            "Authorization":   `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body:JSON.stringify({
            model : "gpt-4o-mini",
            messages: [
                {role: "user" , content : prompt},
                {role : "system" , content : "You are a helpful assistant the answers questions based only the provided context only"}
            ]
        })

    })


     const data = await res.json();



     return data.choices[0].message.content
     
}

// const answer = await getAnswerFromOpenAI("Who made this file?" , releventChunks);
const answer = await getAnswerFromOpenAI("What is Machine Learning?" , releventChunks);

console.log(`✅ Answer: ${answer}`);
