import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import rehypeKatex from "rehype-katex"
import {
  Brain,
  Send,
  BookOpen,
  Lightbulb,
  GraduationCap,
  ChevronDown,
} from "lucide-react"
import type { ChatMessage, StudyTip, SuggestedQuestion } from "./types"
import "katex/dist/katex.min.css"

const MODES = [
  { id: "explain", label: "Explain", icon: BookOpen },
  { id: "practice", label: "Practice", icon: Brain },
  { id: "review", label: "Review", icon: GraduationCap },
  { id: "quiz", label: "Quiz", icon: Lightbulb },
]

const DIFFICULTIES = [
  { id: "basic", label: "Basic" },
  { id: "detailed", label: "Detailed" },
  { id: "advanced", label: "Advanced" },
]

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [mode, setMode] = useState("explain")
  const [difficulty, setDifficulty] = useState("detailed")
  const [isLoading, setIsLoading] = useState(false)
  const [studyTips, setStudyTips] = useState<StudyTip[]>([])
  const [suggestedQuestions, setSuggestedQuestions] = useState<
    SuggestedQuestion[]
  >([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const eventSource = useRef<EventSource | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    // Close existing connection if any
    if (eventSource.current) {
      eventSource.current.close()
    }

    // Create new SSE connection
    const params = new URLSearchParams({
      message: userMessage,
      study_mode: mode,
      difficulty_preference: difficulty,
    })

    eventSource.current = new EventSource(
      `http://localhost:8000/chat-stream?${params}`
    )
    let currentResponse = ""

    eventSource.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "chunk") {
        currentResponse += data.text
        setMessages((prev) => {
          const newMessages = [...prev]
          if (newMessages[newMessages.length - 1]?.role === "assistant") {
            newMessages[newMessages.length - 1].content = currentResponse
          } else {
            newMessages.push({ role: "assistant", content: currentResponse })
          }
          return newMessages
        })
      } else if (data.type === "final") {
        setSuggestedQuestions(
          data.suggested_questions.map((q: string) => ({
            question: q,
            mode: "explain",
          }))
        )
        setStudyTips(
          data.study_tips.map((tip: string) => ({
            tip,
            icon: "Lightbulb",
          }))
        )
        setIsLoading(false)
        eventSource.current?.close()
      } else if (data.type === "error") {
        console.error("Error:", data.error)
        setIsLoading(false)
        eventSource.current?.close()
      }
    }

    eventSource.current.onerror = () => {
      console.error("SSE error")
      setIsLoading(false)
      eventSource.current?.close()
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setInput(question)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col">
        <div className="flex items-center space-x-2 mb-8">
          <Brain className="w-8 h-8 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">StudySage</h1>
        </div>

        {/* Study Modes */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">
            Study Mode
          </h2>
          <div className="space-y-2">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
                  mode === id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty Level */}
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">
            Difficulty
          </h2>
          <div className="space-y-2">
            {DIFFICULTIES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDifficulty(id)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  difficulty === id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Study Tips */}
        {studyTips.length > 0 && (
          <div className="mt-auto">
            <details className="group">
              <summary className="flex items-center text-sm font-semibold text-gray-600 cursor-pointer">
                <ChevronDown className="w-4 h-4 mr-1 transition-transform group-open:rotate-180" />
                Study Tips
              </summary>
              <div className="mt-2 space-y-2">
                {studyTips.map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 text-sm text-gray-600 p-2"
                  >
                    <Lightbulb className="w-4 h-4 mt-0.5 text-yellow-500" />
                    <p>{tip.tip}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-h-screen">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg p-4 ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white shadow-sm border border-gray-200"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  className={`prose ${
                    message.role === "user" ? "prose-invert" : ""
                  } max-w-none`}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {suggestedQuestions.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {suggestedQuestions.map((sq, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(sq.question)}
                  className="flex-shrink-0 px-4 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-full text-gray-700"
                >
                  {sq.question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-gray-200 bg-white"
        >
          <div className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
