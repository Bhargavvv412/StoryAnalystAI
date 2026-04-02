import sys
import json
import traceback

try:
    sys.path.append(r"c:\Users\bharg\OneDrive\Desktop\SGP III\StoryAnalystAI")
    from agents.combined_generator import CombinedGeneratorAgent
    from agents.test_executor import TestExecutorAgent
    from agents.website_explorer import WebsiteExplorerAgent

    story_data = {
        "feature": "Sign Up",
        "user_role": "User",
        "conditions": ["Valid Sign Up"]
    }

    explorer = WebsiteExplorerAgent()
    page_data = explorer.explore("http://127.0.0.1:3000/test-web/index.html?serverWindowId=8d1b882a-39e2-480a-9b23-b7ef332d43e2", depth=1)

    combiner = CombinedGeneratorAgent()
    tcs = combiner.generate(story_data, page_data)
    
    executor = TestExecutorAgent()
    res = executor.execute_all(tcs, headless=True)
    
    with open('test_out3.json', 'w') as f:
        json.dump(res, f, indent=2)
except Exception as e:
    with open('test_out3_err.txt', 'w') as f:
        f.write(traceback.format_exc())
