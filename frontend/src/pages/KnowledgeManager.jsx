import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, FileText, Trash2, Eye, X, Loader2, Database, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

export default function KnowledgeManager() {
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewContent, setViewContent] = useState(null);
  
  const fileInputRef = useRef(null);

  const fetchKnowledge = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/knowledge`);
      setKnowledgeList(data);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    try {
      await axios.post(`${API_URL}/api/knowledge/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setSelectedFile(null);
      fetchKnowledge();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(error.response?.data?.error || 'Failed to extract and upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus dokumen ini dari knowledge base?')) {
      try {
        await axios.delete(`${API_URL}/api/knowledge/${id}`);
        fetchKnowledge();
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Gagal menghapus dokumen');
      }
    }
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf': return <div className="p-2 bg-red-100 text-red-600 rounded-lg"><FileText className="w-5 h-5" /></div>;
      case 'spreadsheet': return <div className="p-2 bg-green-100 text-green-600 rounded-lg"><FileText className="w-5 h-5" /></div>;
      case 'image': return <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>;
      default: return <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><FileText className="w-5 h-5" /></div>;
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-600" />
            Product Knowledge Base
          </h1>
          <p className="text-gray-500 mt-2">Upload documents, PDFs, Excel, or Images to train your AI.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
            
            <div 
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xlsx,.txt,.png,.jpg,.jpeg"
                onChange={handleChange}
              />
              
              <UploadCloud className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-indigo-600' : 'text-gray-400'}`} />
              
              {selectedFile ? (
                <div className="text-sm font-medium text-gray-900 truncate px-4">
                  {selectedFile.name}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    (Remove)
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-2">Drag & drop your file here, or</p>
                  <button 
                    onClick={onUploadClick}
                    className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
                  >
                    Browse files
                  </button>
                </>
              )}
              
              <p className="text-xs text-gray-500 mt-4 mt-2">
                Supports: PDF, Excel, CSV, TXT, PNG, JPG
              </p>
            </div>

            {isUploading && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <span className="font-semibold">Extracting data...</span>
                  <p className="mt-1 opacity-90 text-xs">Image OCR or large PDFs may take several seconds. Please wait.</p>
                </div>
              </div>
            )}

            <button
              onClick={handleUploadSubmit}
              disabled={!selectedFile || isUploading}
              className={`w-full mt-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                !selectedFile || isUploading 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
              }`}
            >
              {isUploading ? 'Processing...' : 'Upload & Extract'}
            </button>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Extracted Knowledge Base</h2>
            </div>
            
            <div className="flex-1 overflow-auto max-h-[600px]">
              {isLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
              ) : knowledgeList.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <Database className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No documents found</h3>
                  <p className="text-gray-500 mt-1">Upload a document to start building your knowledge base.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {knowledgeList.map((item) => (
                    <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        {item.mediaUrl ? (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                            <img src={`${API_URL}${item.mediaUrl}`} alt="thumbnail" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          getFileIcon(item.fileType)
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate pr-4">{item.title}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(item.createdAt).toLocaleString('id-ID')} • {item.fileType.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setViewContent(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Extracted Text"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Content Modal */}
      {viewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {getFileIcon(viewContent.fileType)}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 truncate max-w-lg">{viewContent.title}</h2>
                  <p className="text-xs text-gray-500">Raw Extracted Text</p>
                </div>
              </div>
              <button
                onClick={() => setViewContent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {viewContent.mediaUrl && (
                <div className="lg:w-1/2 p-6 border-r border-gray-100 overflow-auto bg-gray-50 flex items-center justify-center">
                  <img 
                    src={`${API_URL}${viewContent.mediaUrl}`} 
                    alt="Source" 
                    className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200"
                  />
                </div>
              )}
              
              <div className={`p-6 flex-1 overflow-auto bg-gray-50 rounded-xl border border-gray-200 font-mono text-sm whitespace-pre-wrap text-gray-800 ${viewContent.mediaUrl ? 'm-6 lg:ml-0' : 'm-6'}`}>
                {viewContent.content}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
