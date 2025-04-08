from Comment_Analyizer import app
import os

def open_browser():
    import webbrowser
    webbrowser.open_new("http://127.0.0.1:5000")

if __name__ == '__main__':
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':  # 只在 Flask 实际运行时执行
        import threading
        threading.Timer(0.2, open_browser).start()  # 延迟 0.2 秒打开浏览器
    app.run(debug=True, port=5000)