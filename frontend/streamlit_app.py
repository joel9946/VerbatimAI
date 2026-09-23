#	streamlit_app.py
#	This	is	the	simple	website	the	user	actually	sees	and	types
#	into.	It	just	sends	questions	to	our	FastAPI	backend	and
#	displays	the	answer.
import	streamlit	as	st										#	the	library	that	turns	this	Python	script	into	a	website
import	requests																				#	used	to	call	our	own	backend	API
st.title("	Documentation	Copilot")																										#	big	title	text	at	the	top	of	the	page
st.write("Ask	me	anything	about	the	docs	I	was	trained	on.")					#	a	short	description	under	the	title
import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000/ask")
question = st.text_input("Your question:")

if st.button("ask") and question:
    with st.spinner("thinking....."):
        try:
            response = requests.post(BACKEND_URL, json={"question": question}, timeout=30)
            if response.status_code == 200:
                data = response.json()
                answer = data.get("answer", "")
                top_source = data.get("top_source")
                top_score = data.get("top_score", 0.0)
                latency_ms = data.get("latency_ms", 0)

                st.markdown(f"**Answer:** {answer}")
                if top_source:
                    st.caption(f"Source: {top_source} | Confidence: {top_score:.2f} | {latency_ms}ms")
            else:
                st.error(f"Backend returned error {response.status_code}: {response.text}")
        except Exception as e:
            st.error(f"Could not connect to backend at {BACKEND_URL}: {e}")	 