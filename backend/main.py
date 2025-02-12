import os
import json
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY is not set in the environment.")

# Initialize FastAPI app
app = FastAPI(
    title="StudySage",
    description="An intelligent study assistant powered by Gemini AI",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Study assistant prompt
STUDY_PROMPT = """
You are an intelligent and adaptable study assistant designed to help students learn any subject. Your role is to:

1. Provide clear, accurate explanations for any academic topic
2. Break down complex concepts into understandable parts
3. Offer relevant examples and real-world applications
4. Guide students through problem-solving with scaffolded hints
5. Encourage critical thinking and deeper understanding
6. Help students discover answers through guided exploration
7. Provide practice opportunities when appropriate
8. Share effective study strategies and learning techniques
9. Adapt explanations based on student comprehension
10. Support both theoretical understanding and practical application

Remember to:
- Maintain an encouraging and patient tone
- Ask clarifying questions when needed
- Provide multiple perspectives when relevant
- Connect concepts across different fields of study
- Encourage metacognition and self-reflection
"""


def get_chat_client():
    """Initialize and return a new chat session"""
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        chat = client.chats.create(model="gemini-2.0-flash")
        # Initialize with the universal study prompt
        chat.send_message(STUDY_PROMPT)
        return chat
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to initialize study assistant"
        )


def generate_general_study_tips() -> List[str]:
    """Generate universal study tips"""
    return [
        "Break complex topics into smaller, manageable parts",
        "Use active recall techniques instead of passive reading",
        "Teach concepts to others to reinforce understanding",
        "Create mind maps to visualize connections between ideas",
        "Take regular breaks to maintain focus and productivity",
    ]


@app.get("/chat-stream")
async def chat_stream_endpoint(
    message: str = Query(..., description="Student's question or message"),
    study_mode: str = Query(
        "explain", description="Study mode (explain/practice/review/quiz)"
    ),
    difficulty_preference: str = Query(
        "detailed",
        description="Preferred explanation difficulty (basic/detailed/advanced)",
    ),
    chat_session=Depends(get_chat_client),
):
    """
    Endpoint that streams the Gemini response via SSE using GET.
    """
    # Construct the context-aware prompt
    prompt = f"Study Mode: {study_mode}\n"
    if difficulty_preference:
        prompt += f"Preferred Detail Level: {difficulty_preference}\n"
    prompt += f"\nStudent Question: {message}"

    def event_generator():
        try:
            # Get streaming response from Gemini
            response_stream = chat_session.send_message_stream(prompt)
            # Yield each chunk as an SSE event
            for chunk in response_stream:
                data = json.dumps({"type": "chunk", "text": chunk.text})
                yield f"data: {data}\n\n"

            # After streaming is complete, send a final event with extra data
            suggestions = [
                "Could you explain this in a different way?",
                "How can I apply this knowledge practically?",
                "What are some related concepts I should understand?",
                "Can you give me a practice problem?",
            ]
            study_tips = generate_general_study_tips()
            data = json.dumps(
                {
                    "type": "final",
                    "suggested_questions": suggestions,
                    "study_tips": study_tips,
                }
            )
            yield f"data: {data}\n\n"
        except Exception as e:
            data = json.dumps({"type": "error", "error": str(e)})
            yield f"data: {data}\n\n"

    # Return the response as an SSE stream
    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
