import streamlit as st
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager, OpenAIWrapper
import os

os.environ["AUTOGEN_USE_DOCKER"] = "0"

if 'output' not in st.session_state:
    st.session_state.output = {
        'assessment': '',
        'action': '',
        'followup': ''
    }

st.sidebar.title("OpenAI API Key")
api_key = st.sidebar.text_input("Enter your OpenAI API Key", type="password")

st.sidebar.warning("""
## ⚠️ Important Notice

This application is a supportive tool and does not replace professional mental health care. If you're experiencing thoughts of self-harm or severe crisis:

- Call National Crisis Hotline: 988
- Call Emergency Services: 911
- Seek immediate professional help
""")

st.title("🧠 Mental Wellbeing Agent (Simplified Version)")

st.info("""
**Meet Your Mental Wellbeing Agent Team:**

🧠 **Assessment Agent** - Analyzes your situation and emotional needs
🎯 **Action Agent** - Creates immediate action plan and connects you with resources
🔄 **Follow-up Agent** - Designs your long-term support strategy
""")

st.subheader("Personal Information")
col1, col2 = st.columns(2)

with col1:
    mental_state = st.text_area("How have you been feeling recently?", 
        placeholder="Describe your emotional state, thoughts, or concerns...")
    sleep_pattern = st.select_slider(
        "Sleep Pattern (hours per night)",
        options=[f"{i}" for i in range(0, 13)],
        value="7"
    )
    
with col2:
    stress_level = st.slider("Current Stress Level (1-10)", 1, 10, 5)
    support_system = st.multiselect(
        "Current Support System",
        ["Family", "Friends", "Therapist", "Support Groups", "None"]
    )

recent_changes = st.text_area(
    "Any significant life changes or events recently?",
    placeholder="Job changes, relationships, losses, etc..."
)

current_symptoms = st.multiselect(
    "Current Symptoms",
    ["Anxiety", "Depression", "Insomnia", "Fatigue", "Loss of Interest", 
     "Difficulty Concentrating", "Changes in Appetite", "Social Withdrawal",
     "Mood Swings", "Physical Discomfort"]
)

if st.button("Get Support Plan"):
    if not api_key:
        st.error("Please enter your OpenAI API key.")
    else:
        with st.spinner('🤖 AI Agents are analyzing your situation...'):
            try:
                # Create the task description
                task = f"""
                Create a comprehensive mental health support plan based on:
                
                Emotional State: {mental_state}
                Sleep: {sleep_pattern} hours per night
                Stress Level: {stress_level}/10
                Support System: {', '.join(support_system) if support_system else 'None reported'}
                Recent Changes: {recent_changes}
                Current Symptoms: {', '.join(current_symptoms) if current_symptoms else 'None reported'}
                
                Please provide a structured response with three sections:
                1. Assessment: Analyze the emotional state and psychological needs
                2. Action Plan: Provide immediate coping strategies and resources
                3. Follow-up Strategy: Design long-term support and prevention plans
                """

                # Configure LLM
                llm_config = {
                    "config_list": [{"model": "gpt-4o", "api_key": api_key}],
                    "temperature": 0.7
                }

                # Create agents
                assessment_agent = AssistantAgent(
                    name="assessment_agent",
                    system_message="""
                    You are an experienced mental health professional. Your role is to:
                    1. Analyze emotional state with clinical precision and empathy
                    2. Identify patterns in thoughts, behaviors, and relationships
                    3. Assess risk levels with validated screening approaches
                    4. Help understand current mental health in accessible language
                    5. Validate experiences without minimizing or catastrophizing
                    
                    Always use "you" and "your" when addressing the user. Blend clinical expertise with genuine warmth.
                    """,
                    llm_config=llm_config
                )

                action_agent = AssistantAgent(
                    name="action_agent",
                    system_message="""
                    You are a crisis intervention and resource specialist. Your role is to:
                    1. Provide immediate evidence-based coping strategies
                    2. Connect with appropriate mental health services
                    3. Create concrete daily wellness plans
                    4. Suggest specific support communities
                    5. Teach simple self-regulation techniques
                    
                    Focus on practical, achievable steps that respect current capacity and energy levels.
                    """,
                    llm_config=llm_config
                )

                followup_agent = AssistantAgent(
                    name="followup_agent",
                    system_message="""
                    You are a mental health recovery planner. Your role is to:
                    1. Design personalized long-term support strategies
                    2. Create progress monitoring systems
                    3. Develop relapse prevention strategies
                    4. Build graduated self-care routines
                    5. Plan for setbacks with self-compassion techniques
                    
                    Focus on building sustainable habits that integrate with lifestyle and values.
                    """,
                    llm_config=llm_config
                )

                # Create user proxy agent
                user_proxy = UserProxyAgent(
                    name="user_proxy",
                    human_input_mode="NEVER",
                    max_consecutive_auto_reply=10,
                    llm_config=llm_config
                )

                # Create group chat
                groupchat = GroupChat(
                    agents=[user_proxy, assessment_agent, action_agent, followup_agent],
                    messages=[],
                    max_round=15
                )

                # Create group chat manager
                manager = GroupChatManager(
                    groupchat=groupchat,
                    llm_config=llm_config
                )

                # Start the conversation
                result = user_proxy.initiate_chat(
                    manager,
                    message=task
                )

                # Extract the conversation
                conversation = result.chat_history
                
                # Parse the conversation to extract sections
                full_response = ""
                for message in conversation:
                    if message.get('role') == 'assistant':
                        full_response += message.get('content', '') + "\n\n"

                # Simple parsing to separate sections
                sections = full_response.split('\n\n')
                
                # Store results
                st.session_state.output = {
                    'assessment': sections[0] if len(sections) > 0 else full_response,
                    'action': sections[1] if len(sections) > 1 else "",
                    'followup': sections[2] if len(sections) > 2 else ""
                }

                # Display results
                with st.expander("Situation Assessment", expanded=True):
                    st.markdown(st.session_state.output['assessment'])

                with st.expander("Action Plan & Resources"):
                    st.markdown(st.session_state.output['action'])

                with st.expander("Long-term Support Strategy"):
                    st.markdown(st.session_state.output['followup'])

                st.success('✨ Mental health support plan generated successfully!')

            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
                st.error("Please check your API key and try again.") 