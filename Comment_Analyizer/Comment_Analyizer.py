from flask import Flask, request, jsonify, send_file, render_template
import pandas as pd
import json
import requests
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
from openai import OpenAI
import tiktoken
import webbrowser
import threading
import os

# By Shilong Ren at 2025/04/08
# shilong_r@163.com

app = Flask(__name__, 
    static_folder='static',  # 指定静态文件夹名称
    static_url_path='/static' # 指定静态文件URL路径
)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get_system_prompt', methods=['POST'])
def get_system_prompt():
    try:
        data = request.json
        topics = data.get('topics', {})
        
        system_prompt = construct_system_prompt(topics)

        return jsonify({
            'status': 'success',
            'system_prompt': system_prompt
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
    
@app.route('/calculate-tokens', methods=['POST'])
def calculate_tokens():
    data = request.json
    rows = data['data']
    content_column = data['content_column']
    model = data['model']
    topics = data['topics']
    rowsToProcess = data['rowsToProcess']

    system_prompt = construct_system_prompt(topics)

    # 输出text是system prompt在 “##Output” 后面的所有内容
    output_text = system_prompt.split("## Output Format")[1]

    
    total_input_tokens = 0
    total_output_tokens = 0
    token_details = []
    
    # 一次性处理所有文本
    texts = [row[content_column] for row in rows if content_column in row]

    encoding = tiktoken.get_encoding("cl100k_base")  # 使用通用的编码器
    
    # 使用你的token计算方法
    # 例如使用tiktoken
    i = 0
    for text in texts:
        num_tokens = len(encoding.encode(text)) + len(encoding.encode(system_prompt))
        total_input_tokens += num_tokens
        total_output_tokens += len(encoding.encode(output_text))
        token_details.append(num_tokens)
        i += 1
        if i == rowsToProcess:
            break

    pricing = load_pricing_config()

    if model not in pricing:
        print(f"Can not find pricing configuration for {model} in pricing_config.json.")
        input_price = 0
        output_price = 0
    else:
        # Calculate costs
        input_price = pricing[model]["input"]
        output_price = pricing[model]["output"]
        print(f"Pricing configuration for {model} are {input_price}, {output_price}")

    total_cost = (total_input_tokens * (input_price) + total_output_tokens * (output_price) ) /1000000

    print(f"Total cost: {total_cost}")
    return jsonify({
        'status': 'success',
        'total_cost': total_cost
    })


def load_config(config_file='config/api_key_config.json'):
    """Load API configuration from JSON file."""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Configuration file '{config_file}' not found.")
    except json.JSONDecodeError:
        raise ValueError(f"Invalid JSON format in '{config_file}'.")
    
def load_pricing_config(config_file='config/pricing_config.json'):
    """Load pricing configuration from JSON file."""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Configuration file '{config_file}' not found.")
    
    
def define_API(model_using):
    """Define the API client based on the model type."""

    print("Defining API client:", model_using)
    try:
        config = load_config()
        
        if 'qwen' in model_using:
            client = OpenAI(
                api_key=config['qwen']['api_key'],
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
            )
        elif 'deepseek' in model_using:
            client = OpenAI(
                api_key=config['deepseek']['api_key'],
                base_url="https://api.deepseek.com"
            )
        else:
            print(f'Cannot recognize model: {model_using}')
            client = None
            
        pricing = load_pricing_config()

        if model_using not in pricing:
            print(f"Can not find pricing configuration for {model_using} in pricing_config.json.")
            input_price = 0
            output_price = 0
        else:
            # Calculate costs
            input_price = pricing[model_using]["input"]
            output_price = pricing[model_using]["output"]

        return client, input_price, output_price
        
    except KeyError as e:
        raise KeyError(f"Missing configuration for {e} in config file.")
    except Exception as e:
        raise Exception(f"Error initializing API client: {str(e)}")


def construct_system_prompt(topics):
    """Construct whole system prompt"""
    system_prompt = f"""## Task Description
Analyze text segments to detect the presence of specific topics. For each text segment, output a binary classification (0 or 1) for each predefined topic, where:
- 0: Topic is not mentioned in the text
- 1: Topic is explicitly mentioned in the text

## Rule
- Consider synonyms and related terms for each topic
- Rely on the detailed description for each topic to guide your analysis
- Do not include comments in the actual output

## Analysis Topics
{json.dumps(topics, indent=2)}

## Output Format
{{
{',\\n'.join(f'"{topic}": 0 or 1' for topic in topics.keys())}
}}"""
    return system_prompt


def call_llm(index, content, system_text, feature_length, client, model_using, titles):
    print_all_result = 0
    max_output_tokens = 128
    print(f"Calling LLM for index {index}")
    
    content_push = f"""
    Here is the text:
    {content}
    """
    
    json_pattern = r'{[\s\S]*}'  # Pattern to match entire JSON object
    
    finish_query = 0
    attempt = 0
    
    while finish_query == 0:
        attempt += 1
        
        try:
            completion = client.chat.completions.create(
                model=model_using,
                messages=[{"role": "system", "content": system_text},
                          {"role": "user", "content": content_push}],
                temperature=0.2,
                max_tokens=max_output_tokens
            )
            message = completion.choices[0].message.content
            print('--------------------', f"{attempt}th attempt: {message}", "-------------------")
            input_token = completion.usage.prompt_tokens
            output_token = completion.usage.completion_tokens
            input_cost, output_cost, total_cost = 0, 0, 0
        except Exception as e:
            print(f"Error in API call: {e}")
            message = None
        
        try:
            # Try parsing JSON response
            json_str = re.search(json_pattern, message).group()
            print("\n", "Json STRR", json_str)
            results = json.loads(json_str)
            
            # Extract values in the order of titles
            matches = [results.get(title, 0) for title in titles]
            
            print("\n", "Matches", matches)

            if matches is not None:
                # Important: Use the original index passed to the function
                numbers = [index] + [content] + matches
                finish_query = 1
                
                if sum(matches) == 0:
                    numbers = numbers + [1] + [0]  # None Flag = 1, GPT Flag = 0
                else:
                    numbers = numbers + [0] + [0]  # None Flag = 0, GPT Flag = 0
                    
                print(f"Successfully processed with numbers: {numbers}")
                return numbers
        except:
            matches = None
            print("\nFailed to parse JSON format")
        
        if finish_query == 0:
            try: 
                if completion['code'] == 336501:
                    attempt -= 1
                    time.sleep(1)
            except:
                if attempt > 1:
                    max_output_tokens = 168
                    
                if attempt > 3:
                    key_word_result = [0] * feature_length # Just out put all 0
                    # Important: Use the original index hclassification = ere too
                    numbers = [index] + [content] + key_word_result
                    finish_query = 1
                    
                    if sum(key_word_result) == 0:
                        numbers = numbers + [1] + [1]  # None Flag = 1, GPT Flag = 1
                    else:
                        numbers = numbers + [0] + [1]  # None Flag = 0, GPT Flag = 1
                        
                    return numbers


@app.route('/process', methods=['POST'])
def process():
    print("Processing request...")
    try:
        # Step 1: Parse request data
        data = request.json
        print(f"Received data structure: {list(data.keys())}")
        
        # Step 2: Create DataFrame
        df = pd.DataFrame(data['data'])
        print(f"DataFrame shape: {df.shape}")
        
        # Step 3: Get parameters
        content_col = data['content_column']
        unique_id_col = data.get('unique_id_column', '')  # default to empty string if not provided
        topics = data['topics']
        max_workers = data['max_workers']
        rows_to_tag = data['rows_to_tag']
        model_using = data['model']
        titles = data['titles']
        feature_length = data['feature_length']
        
        print('------------------------------------')
        print(f"Content column: {content_col}")
        print(f"Unique ID column: {unique_id_col}")
        print(f"Topics: {topics}")
        print(f"Titles: {titles}")
        print(f"Model: {model_using}")
        print('------------------------------------')
        
        # Step 4: Build system prompt
        system_text = construct_system_prompt(topics)
        
        # Step 5: Initialize API client
        client, input_price, output_price = define_API(model_using)
        if client is None:
            raise ValueError(f"Failed to initialize API client for model {model_using}")
        
        # Step 6: Process data
        results = [None] * min(rows_to_tag, len(df))
        n_rows = min(rows_to_tag, len(df))
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_index = {}

            for idx in range(n_rows):
                try:
                    content = df.iloc[idx][content_col]
                    row_index = df.iloc[idx].get('index', idx + 1)
                    print(f"Submitting task for index {row_index}, position {idx}")

                    future = executor.submit(
                        call_llm,
                        row_index,
                        content,
                        system_text,
                        feature_length,
                        client,
                        model_using,
                        titles
                    )
                    future_to_index[future] = idx
                except Exception as e:
                    print(f"Error submitting task for index {idx}, row {row_index}: {str(e)}")
                    key_word_result = [0] * feature_length
                    content = df.iloc[idx][content_col]
                    row_index = df.iloc[idx].get('index', idx + 1)
                    if unique_id_col:
                        unique_id = df.iloc[idx][unique_id_col]
                        results[idx] = [row_index, content, unique_id] + key_word_result + [1, 1]
                    else:
                        results[idx] = [row_index, content] + key_word_result + [1, 1]

            print("Collecting results")

            for future in as_completed(future_to_index):
                original_idx = future_to_index[future]
                try:
                    result = future.result()  # Should return: [row_index, content, ...keywords]
                    if result is not None:
                        row_index = result[0]
                        content = result[1]
                        keywords = result[2:]

                        if unique_id_col:
                            unique_id = df.iloc[original_idx][unique_id_col]
                            full_result = [row_index, content, unique_id] + keywords
                        else:
                            full_result = [row_index, content] + keywords

                        results[original_idx] = full_result
                        print(f"Successfully processed result for position {original_idx}, row {row_index}")
                    else:
                        row_index = df.iloc[original_idx].get('index', original_idx + 1)
                        content = df.iloc[original_idx][content_col]
                        key_word_result = [0] * feature_length
                        if unique_id_col:
                            unique_id = df.iloc[original_idx][unique_id_col]
                            results[original_idx] = [row_index, content, unique_id] + key_word_result + [1, 1]
                        else:
                            results[original_idx] = [row_index, content] + key_word_result + [1, 1]
                        print(f"Null result received for position {original_idx}, creating fallback")
                except Exception as e:
                    row_index = df.iloc[original_idx].get('index', original_idx + 1)
                    content = df.iloc[original_idx][content_col]
                    key_word_result = [0] * feature_length
                    if unique_id_col:
                        unique_id = df.iloc[original_idx][unique_id_col]
                        results[original_idx] = [row_index, content, unique_id] + key_word_result + [1, 1]
                    else:
                        results[original_idx] = [row_index, content] + key_word_result + [1, 1]
                    print(f"Task failed for position {original_idx}, row {row_index}: {str(e)}")

        # Step 6.5: Ensure no null entries
        for idx in range(len(results)):
            if results[idx] is None:
                row_index = df.iloc[idx].get('index', idx + 1)
                content = df.iloc[idx][content_col]
                key_word_result = [0] * feature_length
                if unique_id_col:
                    unique_id = df.iloc[idx][unique_id_col]
                    results[idx] = [row_index, content, unique_id] + key_word_result + [1, 1]
                else:
                    results[idx] = [row_index, content] + key_word_result + [1, 1]
                print(f"Filling missing result for position {idx}, row {row_index}")
        
        # Step 7: Create output DataFrame
        base_columns = ['Number', 'Content']
        if unique_id_col:
            base_columns.append('Unique_ID')
        base_columns += titles + ['None Flag', 'GPT_Filtered_Flag']
        df_output = pd.DataFrame(results, columns=base_columns)
        df_output = df_output.sort_values(by='Number', ascending=True)

        
        print(f"Expected {n_rows} rows, processed {len(df_output)} rows")
        if len(df_output) < n_rows:
            print("WARNING: Some rows were not processed!")
        
        # Step 8: Return response
        response_data = {
            'status': 'success',
            'data': df_output.to_dict('records'),
            'total_processed': len(results),
            'failed_tagged': sum(df_output['GPT_Filtered_Flag'])
        }
        return jsonify(response_data)

    except Exception as e:
        print(f"Error in process route: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'error_type': str(type(e))
        }), 500