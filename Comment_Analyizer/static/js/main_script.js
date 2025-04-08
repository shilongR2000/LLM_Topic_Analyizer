class CommentMarker {
    constructor() {
        this.data = null;
        this.workbook = null;
        this.startTime = null;
        this.processTimer = null;
        this.titles = [];
        this.featureLength = 0;
        this.results = [];
        this.processingActive = false;

        this.initializeElements();
        this.attachEventListeners();
        this.initializeSystemText();

        this.initializeTopicsUpload(); // Add this line
    }

    initializeElements() {
        // Input elements
        this.fileInput = document.getElementById('fileInput');
        this.fileName = document.getElementById('fileName');
        this.columnSelectSection = document.getElementById('columnSelectSection');
        this.uniqueIdColumnSection = document.getElementById('uniqueIdColumnSection');
        this.uniqueIdColumn = document.getElementById('uniqueIdColumn');
        this.contentColumn = document.getElementById('contentColumn');
        this.systemTextInput = document.getElementById('systemText'); // 重命名以避免混淆
        this.parallelLines = document.getElementById('parallelLines');
        this.rowsToProcess = document.getElementById('rowsToProcess');

        // Progress elements
        this.progressBar = document.getElementById('progressBar');
        this.currentRow = document.getElementById('currentRow'); // 确保正确获取 currentRow 元素
        this.processedCount = document.getElementById('processedCount');
        this.failedCount = document.getElementById('failedCount');
        this.elapsedTime = document.getElementById('elapsedTime');
        this.estimatedTime = document.getElementById('estimatedTime');
        this.estimatedCost = document.getElementById('estimatedCost');

        // Buttons
        this.processBtn = document.getElementById('processBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.copySystemPromptBtn = document.getElementById('copySystemPromptBtn');
        this.updateEstimatedCostBtn = document.getElementById('updateEstimatedCostBtn');

        // 在初始化属性部分添加
        this.stopBtn = document.getElementById('stopBtn');
        this.stopRequested = false;


        // Sections
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsTable = document.getElementById('resultsTable');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (event) => this.handleFileUpload(event));
        this.processBtn.addEventListener('click', () => this.startProcessing());
        this.downloadBtn.addEventListener('click', () => this.downloadResults());
        this.copySystemPromptBtn.addEventListener('click', () => this.copySystemPrompt());
        this.updateEstimatedCostBtn.addEventListener('click', () => this.updateEstimatedCost());

        // 在事件监听器部分添加
        this.stopBtn.addEventListener('click', () => this.stopProcessing());

        // 添加 topic 相关的事件监听器
        document.querySelector('button[data-action="addTopic"]')
            .addEventListener('click', () => this.addTopicRow());

        // 为所有移除按钮添加事件委托
        document.getElementById('topicsTable').addEventListener('click', (e) => {
            if (e.target && e.target.matches('button[data-action="removeTopic"]')) {
                this.removeTopicRow(e.target);
            }
        });
    }


    initializeSystemText() {
        const table = document.getElementById('topicsTable').getElementsByTagName('tbody')[0];
        if (!table) {
            console.error('Topics table not found');
            return;
        }

        const rows = table.getElementsByTagName('tr');
        let topics = {};

        // 遍历每一行获取主题和描述
        for (let row of rows) {
            const inputs = row.getElementsByTagName('input');
            if (inputs.length >= 2) {
                const topic = inputs[0].value.trim();
                const description = inputs[1].value.trim();
                if (topic && description) {
                    topics[topic] = {
                        description: description
                    };
                }
            }
        }

        // 更新titles数组
        this.titles = Object.keys(topics);

        // 更新systemText的值（如果元素存在）
        if (this.systemTextInput) {
            this.systemTextInput.value = JSON.stringify(topics);
            // 触发change事件
            const event = new Event('change', { bubbles: true });
            this.systemTextInput.dispatchEvent(event);
        } else {
            console.error('System text input element not found');
        }
    }


    // By Shilong Ren at 2025/04/08
    // shilong_r @163.com
    // Add these methods to your CommentMarker class
    initializeTopicsUpload() {
        const topicsFileInput = document.getElementById('topicsFileInput');
        topicsFileInput.addEventListener('change', (event) => this.handleTopicsFileUpload(event));
    }

    async readTopicsFile(file) {
        if (file.name.toLowerCase().endsWith('.csv')) {
            return this.readCSVFile(file);
        } else if (file.name.toLowerCase().endsWith('.xlsx')) {
            return this.readExcelFile(file);
        }
        throw new Error('Unsupported file format');
    }

    readCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const results = Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true
                    });
                    resolve(results.data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    addTopicRowWithData(topic, description) {
        const table = document.querySelector('#topicsTable tbody');
        if (!table) {
            console.error('Topics table body not found');
            return;
        }

        const newRow = table.insertRow();
        const cell1 = newRow.insertCell(0);
        const cell2 = newRow.insertCell(1);
        const cell3 = newRow.insertCell(2);

        cell1.className = "border px-4 py-2";
        cell2.className = "border px-4 py-2";
        cell3.className = "border px-4 py-2";

        // 使用安全的方式设置输入值
        const topicInput = document.createElement('input');
        topicInput.type = 'text';
        topicInput.className = 'w-full';
        topicInput.value = topic;
        topicInput.addEventListener('input', () => this.initializeSystemText());

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.className = 'w-full';
        descInput.value = description;
        descInput.addEventListener('input', () => this.initializeSystemText());

        const removeButton = document.createElement('button');
        removeButton.className = 'text-red-600 hover:text-red-800';
        removeButton.setAttribute('data-action', 'removeTopic');
        removeButton.textContent = 'Remove';

        cell1.appendChild(topicInput);
        cell2.appendChild(descInput);
        cell3.appendChild(removeButton);
    }

    addTopicRow() {
        const table = document.getElementById('topicsTable').getElementsByTagName('tbody')[0];
        const newRow = table.insertRow();
        const cell1 = newRow.insertCell(0);
        const cell2 = newRow.insertCell(1);
        const cell3 = newRow.insertCell(2);

        cell1.className = "border px-4 py-2";
        cell2.className = "border px-4 py-2";
        cell3.className = "border px-4 py-2";

        cell1.innerHTML = '<input type="text" class="w-full">';
        cell2.innerHTML = '<input type="text" class="w-full">';
        cell3.innerHTML = '<button class="text-red-600 hover:text-red-800" data-action="removeTopic">Remove</button>';

        this.initializeSystemText();
    }

    removeTopicRow(button) {
        const row = button.closest('tr');
        if (row) {
            row.remove();
            this.initializeSystemText();
        }
    }

    stopProcessing() {
        if (this.processingActive) {
            this.stopRequested = true;
            this.updateStatusMessage("Stopping process... Current results will be displayed once completed.");
        }
    }

    // 可以添加一个简单的状态消息方法
    updateStatusMessage(message) {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) {
            const messageEl = document.createElement('p');
            messageEl.id = 'statusMessage';
            messageEl.className = 'text-center font-bold mt-2';
            document.querySelector('.progress-section').appendChild(messageEl);
            messageEl.textContent = message;
        } else {
            statusElement.textContent = message;
        }
    }


    // 新增的计算价格的函数 
    // TODO 计算价格
    async updateEstimatedCost() {
        if (!this.workbook) return;

        try {
            // 获取第一个工作表的所有数据
            const worksheet = this.workbook.Sheets[this.workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet);
            const rowsToProcess = Math.min(parseInt(this.rowsToProcess.value), data.length);

            const topics = {};

            document.querySelectorAll('#topicsTable tbody tr').forEach(tr => {
                const topicName = tr.cells[0].querySelector('input').value;
                const description = tr.cells[1].querySelector('input').value;
                topics[topicName] = { description };
            });


            // 准备要发送的数据
            const requestData = {
                data: data,
                content_column: this.contentColumn.value,
                model: document.querySelector('input[name="model"]:checked').value, 
                topics: topics,
                rowsToProcess: rowsToProcess
            };

            // 发送所有数据到后端进行处理
            const response = await fetch('/calculate-tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            // 显示结果
            const totalCost = result['total_cost'];


            // 更新显示的预计成本
            if (this.estimatedCost) {
                this.estimatedCost.textContent = totalCost.toFixed(4);
            } else {
                console.error('Estimated cost element not found');
            }
        } catch (error) {
            console.error('Error calculating tokens:', error);
            throw error;
        }
    }
    
    

    async handleTopicsFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            console.log('Starting file upload:', file.name); // 调试日志
            const data = await this.readTopicsFile(file);
            console.log('File data:', data); // 调试日志

            if (!data || !data.length) {
                throw new Error('No data found in file');
            }

            // Find Topic and Description columns (case-insensitive)
            const headers = Object.keys(data[0]);
            const topicColumn = headers.find(h => h.toLowerCase() === 'topic');
            const descriptionColumn = headers.find(h => h.toLowerCase() === 'description');

            if (!topicColumn || !descriptionColumn) {
                throw new Error('Required columns "Topic" and "Description" not found');
            }

            // Clear existing topics table
            const tbody = document.querySelector('#topicsTable tbody');
            tbody.innerHTML = '';
            console.log('Cleared existing topics'); // 调试日志

            // Add new topics
            data.forEach(row => {
                const topic = row[topicColumn]?.trim();
                const description = row[descriptionColumn]?.trim();
                if (topic && description) {
                    console.log('Adding topic:', topic); // 调试日志
                    this.addTopicRowWithData(topic, description);
                }
            });

            // Update system text
            this.initializeSystemText();

            // 添加额外的UI更新触发
            const changeEvent = new Event('change', { bubbles: true });
            document.getElementById('topicsTable').dispatchEvent(changeEvent);

            console.log('Topics upload completed successfully'); // 调试日志
        } catch (error) {
            console.error('Error in handleTopicsFileUpload:', error);
            alert('Error processing file: ' + error.message);
        }

        // Clear the input
        event.target.value = '';
    }

    getRowCount() {
        if (!this.workbook) return 0;
        const worksheet = this.workbook.Sheets[this.workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(worksheet).length;
    }

    updateColumnSelection() {
        if (!this.workbook) return;

        const worksheet = this.workbook.Sheets[this.workbook.SheetNames[0]];
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];

        this.contentColumn.innerHTML = headers.map(header =>
            `<option value="${header}">${header}</option>`
        ).join('');
    }

    showError(message) {
        alert(message);
    }

    async copySystemPrompt() {
        try {
            // Get topics from the table
            const topics = {};
            document.querySelectorAll('#topicsTable tbody tr').forEach(tr => {
                const topicName = tr.cells[0].querySelector('input').value.trim();
                const description = tr.cells[1].querySelector('input').value.trim();
                if (topicName && description) {
                    topics[topicName] = {
                        description: description
                    };
                }
            });

            // Get system prompt from backend
            const response = await fetch('/get_system_prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topics })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                // Copy to clipboard
                await navigator.clipboard.writeText(result.system_prompt);
                alert('System prompt copied to clipboard!');
            } else {
                throw new Error(result.message || 'Failed to get system prompt');
            }
        } catch (error) {
            console.error('Error copying system prompt:', error);
            this.showError('Error copying system prompt: ' + error.message);
        }
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log('No file selected');
            return;
        }

        // 显示文件名
        this.fileName.textContent = file.name;
        console.log('File selected:', file.name);

        try {
            // 读取XLSX文件
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            this.workbook = XLSX.read(data, { type: 'array' });

            // 获取第一个工作表的头部
            const firstSheetName = this.workbook.SheetNames[0];
            const worksheet = this.workbook.Sheets[firstSheetName];
            const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];

            console.log('Headers found:', headers);

            // 确保contentColumn元素存在
            if (!this.contentColumn) {
                console.error('Content column select element not found');
                return;
            }

            // 清空并更新内容列选择下拉框
            this.contentColumn.innerHTML = '';
            headers.forEach(header => {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                this.contentColumn.appendChild(option);
            });

            // 显示列选择区域
            if (this.columnSelectSection) {
                this.columnSelectSection.classList.remove('hidden');
                console.log('Column selection section displayed');
            } else {
                console.error('Column selection section not found');
            }

            // 添加唯一ID列选择逻辑
            if (this.uniqueIdColumn) {
                // 清空并更新唯一ID列选择下拉框
                this.uniqueIdColumn.classList.remove('hidden');

                this.uniqueIdColumn.innerHTML = '';

                // 添加一个空选项
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '-- None --';
                this.uniqueIdColumn.appendChild(emptyOption);

                let idColumnFound = false;

                // 添加所有列作为选项
                headers.forEach(header => {
                    const option = document.createElement('option');
                    option.value = header;
                    option.textContent = header;

                    // 自动选择包含 "id" 或 "group_id" 的列
                    if (header.toLowerCase().includes('id') &&
                        (header.toLowerCase().includes('group') ||
                            header.toLowerCase() === 'id')) {
                        option.selected = true;
                        idColumnFound = true;
                    }

                    this.uniqueIdColumn.appendChild(option);
                });

                // 显示唯一ID列选择区域
                if (this.uniqueIdColumnSection) {
                    this.uniqueIdColumnSection.classList.remove('hidden');
                    console.log('Unique ID column section displayed');
                }
            } else {
                console.error('Unique ID column select element not found');
            }

            // 获取并更新可处理的总行数
            const rowCount = this.getRowCount();
            if (this.rowsToProcess) {
                // 存储最大行数以供全局使用
                this.maxRows = rowCount;

                // 设置输入框的值为总行数
                this.rowsToProcess.value = rowCount;

                // 设置最大值属性
                this.rowsToProcess.setAttribute('max', rowCount);

                // 添加事件监听器，检查并强制修正值
                this.rowsToProcess.addEventListener('input', () => {
                    const inputValue = parseInt(this.rowsToProcess.value);
                    if (inputValue > rowCount) {
                        this.rowsToProcess.value = rowCount; // 如果超过最大值，强制改回最大值
                    }
                });

                // 添加事件监听器，处理失焦事件
                this.rowsToProcess.addEventListener('blur', () => {
                    if (this.rowsToProcess.value === '' || parseInt(this.rowsToProcess.value) <= 0) {
                        this.rowsToProcess.value = rowCount; // 如果为空或非正数，重置为最大值
                    }
                });

                // 可以添加一个文本提示，显示最大可处理行数
                if (this.maxRowsInfo) {
                    this.maxRowsInfo.textContent = `Maximum: ${rowCount} rows`;
                }

                console.log('Total rows:', rowCount);
            }

        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file: ' + error.message);
        }
    }

    // 3. 修改startProcessing方法，添加检查停止标志的逻辑
    async startProcessing() {
        if (!this.workbook || !this.contentColumn.value || this.processingActive) return;

        this.processingActive = true;
        this.processBtn.disabled = true;
        this.stopBtn.disabled = false;  // 启用停止按钮
        this.stopRequested = false;     // 重置停止标志
        this.startTime = Date.now();
        this.updateTimer();

        const worksheet = this.workbook.Sheets[this.workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);
        const totalRows = Math.min(parseInt(this.rowsToProcess.value), data.length);

        const batchSize = parseInt(this.parallelLines.value);
        this.results = [];
        let processedCount = 0;

        try {
            // Process data in batches
            for (let startIndex = 0; startIndex < totalRows; startIndex += batchSize) {
                // 检查是否请求停止
                if (this.stopRequested) {
                    this.updateStatusMessage("Process stopped. Showing partial results.");
                    break;
                }

                const endIndex = Math.min(startIndex + batchSize, totalRows);
                const currentBatch = data.slice(startIndex, endIndex);

                // Update UI before processing batch
                this.updateUIProgress(startIndex, totalRows);

                // Process the current batch
                const batchResults = await Promise.all(
                    currentBatch.map((row, index) =>
                        this.processRow(row, startIndex + index, totalRows)
                    )
                );

                // Filter out null results and add valid results
                const validResults = batchResults.filter(result => result !== null);
                this.results.push(...validResults);

                // Update processed count and UI
                processedCount = this.results.length;
                this.updateUIAfterBatch(processedCount, totalRows);

                // Add a small delay between batches to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 处理结束或停止后显示结果
            this.finishProcessing(this.stopRequested);
        } catch (error) {
            console.error('Processing error:', error);
            this.showError('Processing error: ' + error.message);
        } finally {
            this.processingActive = false;
            this.processBtn.disabled = false;
            this.stopBtn.disabled = true;  // 禁用停止按钮
            clearInterval(this.processTimer);
        }
    }

    async processRow(row, index, total) {
        // const content = row[this.contentColumn.value];
        const topics = {};

        document.querySelectorAll('#topicsTable tbody tr').forEach(tr => {
            const topicName = tr.cells[0].querySelector('input').value;
            const description = tr.cells[1].querySelector('input').value;
            topics[topicName] = { description };
        });

        try {
            const model = document.querySelector('input[name="model"]:checked').value;

            const rowWithIndex = { ...row, index: index + 1 };

            const response = await fetch('/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: [rowWithIndex],
                    content_column: this.contentColumn.value,
                    unique_id_column: this.uniqueIdColumn.value || '',
                    topics: topics,
                    max_workers: 1,
                    rows_to_tag: 1,
                    model: model,
                    titles: this.titles,
                    feature_length: this.featureLength
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'success' && result.data && result.data.length > 0) {
                return result.data[0];
            }
            return null;
        } catch (error) {
            console.error(`Error processing row ${index + 1}:`, error);
            return null;
        }
    }



    updateUIProgress(current, total) {
        requestAnimationFrame(() => {
            if (!total || total <= 0) return; // 防止除以 0

            const safeCurrent = Math.min(current, total); // 不让 current 超过 total
            const percentage = Math.floor((safeCurrent / total) * 100); // 避免四舍五入跳动过大

            if (this.currentRow) {
                this.currentRow.textContent = `Processing Row: ${safeCurrent + 1}/${total}`;
            }

            if (this.progressBar) {
                this.progressBar.style.width = `${percentage}%`;
                this.progressBar.setAttribute('aria-valuenow', percentage); // 可访问性 + debug
            }
        });
    }

    updateUIAfterBatch(processedCount, totalRows) {
        requestAnimationFrame(() => {
            if (!totalRows || totalRows <= 0) return;

            const safeCount = Math.min(processedCount, totalRows);
            const percentage = Math.floor((safeCount / totalRows) * 100);

            if (this.processedCount) {
                this.processedCount.textContent = `Processed: ${safeCount}/${totalRows}`;
            }

            if (this.progressBar) {
                this.progressBar.style.width = `${percentage}%`;
                this.progressBar.setAttribute('aria-valuenow', percentage);
            }

            const failedCount = this.results.filter(r => r.GPT_Filtered_Flag === 1).length;
            if (this.failedCount) {
                this.failedCount.textContent = `Failed: ${failedCount}`;
            }
        });
    }


    // 4. 修改完成处理的方法以支持部分完成
    finishProcessing(wasStoppedByUser = false) {
        clearInterval(this.processTimer);

        const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
        const statusMessage = wasStoppedByUser
            ? `Process stopped. ${this.results.length} rows processed in ${totalTime} seconds.`
            : `Processing complete! ${this.results.length} rows processed in ${totalTime} seconds.`;

        this.updateStatusMessage(statusMessage);

        // 显示结果表格
        this.showResults();

        // 启用下载按钮，如果有结果
        if (this.results.length > 0) {
            this.downloadBtn.disabled = false;
        }
    }

    updateTimer() {
        // 初始化
        this.lastKnownPercentage = 0;
        this.remainingSeconds = null;

        this.processTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.elapsedTime.textContent = `Elapsed: ${this.formatTime(elapsed)}`;

            const processedCount = this.results.length;
            const totalRows = parseInt(this.rowsToProcess.value);

            if (processedCount > 0 && totalRows > 0) {
                const currentPercentage = Math.floor((processedCount / totalRows) * 100);

                // 初次估算剩余时间
                if (this.remainingSeconds === null || currentPercentage !== this.lastKnownPercentage) {
                    const averageTimePerRow = elapsed / processedCount;
                    const remainingRows = totalRows - processedCount;
                    this.remainingSeconds = Math.floor(averageTimePerRow * remainingRows);
                    this.lastKnownPercentage = currentPercentage;
                }

                // 每秒减一
                if (this.remainingSeconds > 0) {
                    this.remainingSeconds -= 1;
                }

                // 实时更新剩余时间显示
                this.estimatedTime.textContent = `Remaining: ${this.formatTime(this.remainingSeconds)}`;
            }
        }, 1000);
    }


    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    
    showResults() {
        // Show the results section
        this.resultsSection.classList.remove('hidden');

        // Clear existing table content
        const thead = this.resultsTable.querySelector('thead tr');
        const tbody = this.resultsTable.querySelector('tbody');
        thead.innerHTML = '';
        tbody.innerHTML = '';

        // Define headers (now including Unique ID after Content)
        const headers = ['#', 'Content', 'Unique ID', ...this.titles, 'None Flag', 'GPT Flag'];

        // Add header cells
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            thead.appendChild(th);
        });

        // Add data rows
        this.results.forEach(result => {
            const tr = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                td.className = 'px-6 py-4 whitespace-nowrap text-sm';

                // Handle different column types
                switch (header) {
                    case '#':
                        td.textContent = result.Number ?? '';
                        break;
                    case 'Content':
                        td.textContent = result.Content ?? '';
                        break;
                    case 'Unique ID':
                        td.textContent = result['Unique_ID'] ?? '';
                        break;
                    case 'None Flag':
                        td.textContent = result.None_Flag ?? 0;
                        break;
                    case 'GPT Flag':
                        td.textContent = result.GPT_Filtered_Flag ?? 0;
                        break;
                    default:
                        td.textContent = result[header] ?? 0;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    downloadResults() {
        if (!this.results.length) return;

        const headers = ['Number', 'Content', 'Unique ID', ...this.titles, 'None Flag', 'GPT_Filtered_Flag'];

        // Create worksheet data with proper default values
        const wsData = this.results.map(row => {
            const rowData = {};
            headers.forEach(header => {
                if (header === 'Content' || header === 'Unique_ID') {
                    // For text columns, keep empty string as default
                    rowData[header] = row[header] || '';
                } else {
                    // For other columns, use 0 as default
                    rowData[header] = row[header] ?? 0;
                }
            });
            return rowData;
        });

        // Create a new workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData, { header: headers });

        // Auto-size columns
        const colWidths = headers.map(header => {
            if (header === 'Content') return { wch: 50 };
            if (header === 'Unique ID') return { wch: 20 };
            return { wch: 15 };
        });
        ws['!cols'] = colWidths;

        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Results');

        // Save the workbook
        XLSX.writeFile(wb, 'results.xlsx');
    }

    showError(message) {
        alert(message);
    }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.commentMarker = new CommentMarker();
});